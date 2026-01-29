import { AccessLog, Vehicle, User, WorkingHours, WorkingHoursRequest, Camera, Department } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination, getStartOfDay, getEndOfDay } from '../utils/response.js';
import { normalizeLicensePlate } from '../utils/licensePlate.js';
import { asyncHandler } from '../middleware/logger.js';
import { processRecognitionImages } from '../utils/fileStorage.js';
import { checkAndApplyRequest } from './workingHoursRequestController.js';
import { createDepartmentFilter, checkResourceAccess } from '../utils/departmentFilter.js';
import { findRelevantWorkingHour, checkViolationWithShift } from '../utils/findRelevantWorkingHour.js';

// Import socketService instance (sẽ được inject từ server.js)
let socketServiceInstance = null;

export const setSocketService = (socketService) => {
  socketServiceInstance = socketService;
};

// Lấy danh sách access logs
export const getAccessLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { 
    action, 
    verificationStatus, 
    gateId, 
    search, 
    startDate, 
    endDate,
    isVehicleRegistered 
  } = req.query;

  // Build base query filter
  const baseFilter = {};
  
  if (action) baseFilter.action = action;
  if (verificationStatus) baseFilter.verificationStatus = verificationStatus;
  if (gateId) baseFilter.gateId = gateId;
  if (isVehicleRegistered !== undefined) baseFilter.isVehicleRegistered = isVehicleRegistered === 'true';
  
  if (startDate || endDate) {
    baseFilter.createdAt = {};
    if (startDate) baseFilter.createdAt.$gte = getStartOfDay(startDate);
    if (endDate) baseFilter.createdAt.$lte = getEndOfDay(endDate);
  }

  try {
    // Tạo department filter
    const departmentFilter = await createDepartmentFilter(req.user, {
      ownerField: 'owner',
      allowSelfOnly: true
    });

    let filter = { ...baseFilter, ...departmentFilter };

    // Xử lý tìm kiếm nếu có tham số search
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const normalizedPlate = normalizeLicensePlate(searchTerm);
      
      // Tìm các User phù hợp với search term (tên hoặc số điện thoại)
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { phone: { $regex: searchTerm, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = matchingUsers.map(user => user._id);
      
      // Thêm điều kiện tìm kiếm: biển số HOẶC chủ xe
      filter = {
        ...filter,
        $or: [
          { licensePlate: { $regex: normalizedPlate, $options: 'i' } },
          { owner: { $in: userIds } }
        ]
      };
    }

    // Execute query
    const [logs, total] = await Promise.all([
      AccessLog.find(filter)
        .populate('vehicle', 'licensePlate vehicleType name color')
        .populate('owner', 'name username phone')
        .populate('verifiedBy', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AccessLog.countDocuments(filter)
    ]);

    const pagination = createPagination(page, limit, total);

    sendPaginatedResponse(res, logs, pagination, 'Lấy danh sách access logs thành công');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});

// Lấy access log theo ID
export const getAccessLogById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const log = await AccessLog.findById(id)
    .populate('vehicle', 'licensePlate vehicleType name color owner')
    .populate('owner', 'name username phone department')
    .populate('verifiedBy', 'name username')
    .populate('camera', 'name location type')
    .populate('metadata.workingHoursRequest.requestedBy', 'name username')
    .populate('metadata.workingHoursRequest.approvedBy', 'name username');
  
  if (!log) {
    return sendErrorResponse(res, 'Không tìm thấy access log', 404);
  }

  // Kiểm tra quyền truy cập
  // Supervisor và super_admin có thể xem tất cả access log
  if (req.user.role === 'supervisor' || req.user.role === 'super_admin') {
    // Supervisor có quyền xem tất cả
    return sendSuccessResponse(res, { log }, 'Lấy thông tin access log thành công');
  }

  // Các role khác kiểm tra quyền theo department hoặc ownership
  const hasAccess = await checkResourceAccess(req.user, log, 'owner');
  if (!hasAccess) {
    return sendErrorResponse(res, 'Không có quyền xem access log này', 403);
  }

  // Đảm bảo trả về đầy đủ thông tin video và media
  const logData = {
    ...log.toObject(),
    // Đảm bảo recognitionData được trả về đầy đủ bao gồm video
    recognitionData: {
      ...log.recognitionData,
      // Giữ nguyên tất cả các field trong recognitionData
      videoUrl: log.recognitionData?.videoUrl || null,
      processedImage: log.recognitionData?.processedImage || null,
      originalImage: log.recognitionData?.originalImage || null
    }
  };

  sendSuccessResponse(res, { log: logData }, 'Lấy thông tin access log thành công');
});

// Core business logic for creating access log (reusable)
export const createAccessLogLogic = async (logData) => {
  const {
    licensePlate,
    action,
    gateId,
    gateName,
    recognitionData,
    deviceInfo,
    weather
  } = logData;

  // Chuẩn hóa biển số
  const normalizedPlate = normalizeLicensePlate(licensePlate);

  // Xử lý ảnh base64 trong recognitionData (nếu có)
  const processedRecognitionData = await processRecognitionImages(
    recognitionData, 
    normalizedPlate, 
    action
  );

  // Tìm thông tin vehicle và owner
  const vehicle = await Vehicle.findOne({ 
    licensePlate: normalizedPlate, 
    isActive: true 
  }).populate('owner');

  // Tìm camera để lấy ngưỡng auto-approve
  let camera = null;
  let autoApproveThreshold = 0.9; // Giá trị mặc định
  
  if (deviceInfo?.cameraId) {
    camera = await Camera.findOne({ cameraId: deviceInfo.cameraId });
    if (camera && camera.recognition?.confidence?.autoApprove) {
      autoApproveThreshold = camera.recognition.confidence.autoApprove;
    }
  }

  // Tạo access log
  const accessLog = new AccessLog({
    licensePlate: normalizedPlate,
    vehicle: vehicle?._id,
    owner: vehicle?.owner?._id,
    action,
    gateId,
    gateName,
    recognitionData: processedRecognitionData,
    isVehicleRegistered: !!vehicle,
    isOwnerActive: vehicle?.owner?.isActive || false,
    deviceInfo,
    camera: camera?._id, // Lưu camera ObjectId
    weather
  });

  // Auto-approve nếu confidence cao hơn ngưỡng từ camera và vehicle đã đăng ký
  if (recognitionData.confidence >= autoApproveThreshold && vehicle && vehicle.owner.isActive) {
    accessLog.verificationStatus = 'auto_approved';
    accessLog.verificationTime = new Date();
    accessLog.verificationNote = `Auto-approved với confidence ${recognitionData.confidence} (threshold: ${autoApproveThreshold})`;
  }

  // Tính duration nếu là exit
  if (action === 'exit') {
    await accessLog.calculateDuration();
  }

  await accessLog.save();

  // Kiểm tra và áp dụng yêu cầu đăng ký giờ hành chính (nếu có)
  const requestCheck = await checkAndApplyRequest(accessLog);
  if (requestCheck.hasValidRequest) {
    // Cập nhật access log với thông tin yêu cầu được phê duyệt
    accessLog.verificationNote = accessLog.verificationNote 
      ? `${accessLog.verificationNote}. Có yêu cầu đăng ký được phê duyệt: ${requestCheck.reason}`
      : `Có yêu cầu đăng ký được phê duyệt: ${requestCheck.reason}`;
    
    // Thêm metadata về yêu cầu đăng ký
    accessLog.metadata = {
      ...accessLog.metadata,
      workingHoursRequest: {
        requestId: requestCheck.requestId,
        requestedBy: requestCheck.requestedBy,
        reason: requestCheck.reason,
        approvedBy: requestCheck.approvedBy,
        approvedAt: requestCheck.approvedAt
      }
    };
    
    await accessLog.save();
  }

  // Populate để trả về đầy đủ thông tin
  const populatedLog = await AccessLog.findById(accessLog._id)
    .populate('vehicle', 'licensePlate vehicleType name color')
    .populate('owner', 'name username phone')
    .populate('verifiedBy', 'name username');

  return { populatedLog, vehicle };
};

// Tạo access log mới (từ AI system) - HTTP endpoint
export const createAccessLog = asyncHandler(async (req, res) => {
  // Kiểm tra req.body tồn tại
  if (!req.body || Object.keys(req.body).length === 0) {
    return sendErrorResponse(res, 'Request body is empty or invalid', 400);
  }

  const result = await createAccessLogLogic(req.body);
  
  sendSuccessResponse(res, { log: result.populatedLog }, 'Tạo access log thành công', 201);
});

// Verify access log (admin only)
export const verifyAccessLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note, guestInfo, correctedData } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return sendErrorResponse(res, 'Trạng thái verify không hợp lệ', 400);
  }

  const accessLog = await AccessLog.findById(id);
  if (!accessLog) {
    return sendErrorResponse(res, 'Không tìm thấy access log', 404);
  }

  if (accessLog.verificationStatus !== 'pending') {
    return sendErrorResponse(res, 'Access log đã được verify', 400);
  }

  // Xử lý cập nhật thông tin biển số nếu có correctedData
  let vehicleInfo = null;
  let ownerInfo = null;
  let isVehicleRegistered = accessLog.isVehicleRegistered;
  
  if (correctedData && correctedData.licensePlate) {
    // Validate và chuẩn hóa biển số mới
    const correctedLicensePlate = normalizeLicensePlate(correctedData.licensePlate);
    
    if (!correctedLicensePlate || correctedLicensePlate.length < 3) {
      return sendErrorResponse(res, 'Biển số không hợp lệ', 400);
    }

    // Tìm kiếm thông tin xe và chủ sở hữu từ biển số mới
    vehicleInfo = await Vehicle.findOne({ licensePlate: correctedLicensePlate });
    
    if (vehicleInfo) {
      ownerInfo = await User.findById(vehicleInfo.owner);
      isVehicleRegistered = true;
      
      // Cập nhật thông tin xe và chủ sở hữu
      accessLog.vehicle = vehicleInfo._id;
      accessLog.owner = vehicleInfo.owner;
      accessLog.isVehicleRegistered = true;
    } else {
      // Xe chưa đăng ký - xóa thông tin xe và chủ sở hữu cũ
      accessLog.vehicle = null;
      accessLog.owner = null;
      accessLog.isVehicleRegistered = false;
      isVehicleRegistered = false;
    }

    // Cập nhật biển số và đánh dấu đã được sửa
    accessLog.licensePlate = correctedLicensePlate;

    // Cập nhật độ tin cậy nếu có
    if (correctedData.confidence !== undefined) {
      accessLog.recognitionData.confidence = Math.min(Math.max(correctedData.confidence, 0), 1);
    }
  }

  // Cập nhật trạng thái verify
  accessLog.verificationStatus = status;
  accessLog.verifiedBy = req.user._id;
  accessLog.verificationTime = new Date();
  accessLog.verificationNote = note;

  // Thêm thông tin khách nếu xe chưa đăng ký và được approve
  if (status === 'approved' && !isVehicleRegistered && guestInfo) {
    // Validate thông tin khách cơ bản
    if (!guestInfo.name || !guestInfo.phone) {
      return sendErrorResponse(res, 'Tên và số điện thoại khách là bắt buộc', 400);
    }

    accessLog.guestInfo = {
      name: guestInfo.name,
      phone: guestInfo.phone,
      idCard: guestInfo.idCard,
      hometown: guestInfo.hometown,
      visitPurpose: guestInfo.visitPurpose,
      contactPerson: guestInfo.contactPerson,
      notes: guestInfo.notes
    };
  }

  await accessLog.save();

  const populatedLog = await AccessLog.findById(accessLog._id)
    .populate('vehicle', 'licensePlate vehicleType name color')
    .populate('owner', 'name username phone')
    .populate('verifiedBy', 'name username');

  // Broadcast verification result
  // Sử dụng dynamic import để tránh circular dependency
  const { default: socketService } = await import('../socket/socketService.js');
  socketService.broadcast('verification_completed', {
    accessLog: populatedLog,
    verifiedBy: req.user
  });

  sendSuccessResponse(res, { log: populatedLog }, 'Verify access log thành công');
});

// Cập nhật thông tin khách cho access log (admin only)
export const updateGuestInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { guestInfo } = req.body;

  const accessLog = await AccessLog.findById(id);
  if (!accessLog) {
    return sendErrorResponse(res, 'Không tìm thấy access log', 404);
  }

  // Chỉ cho phép cập nhật thông tin khách cho xe chưa đăng ký
  if (accessLog.isVehicleRegistered) {
    return sendErrorResponse(res, 'Không thể cập nhật thông tin khách cho xe đã đăng ký', 400);
  }

  // Validate thông tin khách cơ bản
  if (!guestInfo || !guestInfo.name || !guestInfo.phone) {
    return sendErrorResponse(res, 'Tên và số điện thoại khách là bắt buộc', 400);
  }

  accessLog.guestInfo = {
    name: guestInfo.name,
    phone: guestInfo.phone,
    idCard: guestInfo.idCard,
    hometown: guestInfo.hometown,
    visitPurpose: guestInfo.visitPurpose,
    contactPerson: guestInfo.contactPerson,
    notes: guestInfo.notes
  };

  await accessLog.save();

  const populatedLog = await AccessLog.findById(accessLog._id)
    .populate('vehicle', 'licensePlate vehicleType name color')
    .populate('owner', 'name username phone')
    .populate('verifiedBy', 'name username');

  sendSuccessResponse(res, { log: populatedLog }, 'Cập nhật thông tin khách thành công');
});

// Cập nhật thông tin access log khi AI nhận diện sai (supervisor only)
export const updateAccessLogInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { licensePlate, confidence, note } = req.body;

  const accessLog = await AccessLog.findById(id);
  if (!accessLog) {
    return sendErrorResponse(res, 'Không tìm thấy access log', 404);
  }

  // Chỉ cho phép cập nhật access log đang pending hoặc đã approved
  if (!['pending', 'approved'].includes(accessLog.verificationStatus)) {
    return sendErrorResponse(res, 'Không thể cập nhật access log đã bị từ chối', 400);
  }

  // Validate và chuẩn hóa biển số mới
  const correctedLicensePlate = normalizeLicensePlate(licensePlate);
  
  if (!correctedLicensePlate || correctedLicensePlate.length < 3) {
    return sendErrorResponse(res, 'Biển số không hợp lệ', 400);
  }

  // Lưu biển số gốc nếu chưa có
  if (!accessLog.originalLicensePlate) {
    accessLog.originalLicensePlate = accessLog.licensePlate;
  }

  // Tìm kiếm thông tin xe và chủ sở hữu từ biển số mới
  const vehicleInfo = await Vehicle.findOne({ licensePlate: correctedLicensePlate });
  
  if (vehicleInfo) {
    // Xe đã đăng ký - cập nhật thông tin xe và chủ sở hữu
    accessLog.vehicle = vehicleInfo._id;
    accessLog.owner = vehicleInfo.owner;
    accessLog.isVehicleRegistered = true;
    
    // Xóa thông tin khách vãng lai nếu có
    accessLog.guestInfo = undefined;
  } else {
    // Xe chưa đăng ký - xóa thông tin xe và chủ sở hữu cũ
    accessLog.vehicle = null;
    accessLog.owner = null;
    accessLog.isVehicleRegistered = false;
  }

  // Cập nhật biển số và đánh dấu đã được sửa
  accessLog.licensePlate = correctedLicensePlate;
  accessLog.isCorrected = true;
  accessLog.correctedBy = req.user._id;
  accessLog.correctionTime = new Date();

  // Cập nhật độ tin cậy nếu có
  if (confidence !== undefined) {
    accessLog.recognitionData.confidence = Math.min(Math.max(confidence, 0), 1);
  }

  // Thêm ghi chú nếu có
  if (note) {
    accessLog.verificationNote = note;
  }

  // Nếu access log chưa được verify, reset về pending để verify lại
  if (accessLog.verificationStatus === 'approved') {
    accessLog.verificationStatus = 'pending';
    accessLog.verifiedBy = null;
    accessLog.verificationTime = null;
  }

  await accessLog.save();

  const populatedLog = await AccessLog.findById(accessLog._id)
    .populate('vehicle', 'licensePlate vehicleType name color')
    .populate('owner', 'name username phone')
    .populate('verifiedBy', 'name username')
    .populate('correctedBy', 'name username');

  // Broadcast update result
  const { default: socketService } = await import('../socket/socketService.js');
  socketService.broadcast('access_log_corrected', {
    accessLog: populatedLog,
    correctedBy: req.user
  });

  sendSuccessResponse(res, { log: populatedLog }, 'Cập nhật thông tin access log thành công');
});

// Tìm kiếm logs theo thông tin khách
export const getLogsByGuestInfo = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const { limit = 50 } = req.query;

  if (!search || search.trim().length < 2) {
    return sendErrorResponse(res, 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự', 400);
  }

  const logs = await AccessLog.findByGuestInfo(search.trim(), parseInt(limit));

  sendSuccessResponse(res, { 
    logs, 
    count: logs.length 
  }, `Tìm kiếm logs theo thông tin khách: "${search}"`);
});

// Lấy logs theo biển số
export const getLogsByLicensePlate = asyncHandler(async (req, res) => {
  const { licensePlate } = req.params;
  const { limit = 50 } = req.query;

  const normalizedPlate = normalizeLicensePlate(licensePlate);
  
  const logs = await AccessLog.findByLicensePlate(normalizedPlate, parseInt(limit));

  sendSuccessResponse(res, { logs, count: logs.length }, 
    `Lịch sử ra vào của biển số ${normalizedPlate}`);
});

// Lấy logs trong khoảng thời gian
export const getLogsByDateRange = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const { page, limit, skip } = getPaginationParams(req);

  if (!startDate || !endDate) {
    return sendErrorResponse(res, 'Vui lòng cung cấp startDate và endDate', 400);
  }

  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);

  // Validate date range
  if (start >= end) {
    return sendErrorResponse(res, 'startDate phải nhỏ hơn endDate', 400);
  }

  const filter = req.user.role === 'user' ? { owner: req.user._id } : {};
  
  const [logs, total] = await Promise.all([
    AccessLog.findByDateRange(start, end, filter)
      .skip(skip)
      .limit(limit),
    AccessLog.countDocuments({
      ...filter,
      createdAt: { $gte: start, $lte: end }
    })
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, logs, pagination, 'Lấy logs theo khoảng thời gian thành công');
});

// Lấy thống kê hàng ngày
export const getDailyStats = asyncHandler(async (req, res) => {
  const { date } = req.query;
  
  const targetDate = date ? new Date(date) : new Date();
  
  const stats = await AccessLog.getDailyStats(targetDate);

  // Thêm thống kê vehicles đang trong khuôn viên
  const vehiclesInside = await AccessLog.findVehiclesInside();

  sendSuccessResponse(res, {
    date: targetDate,
    stats,
    vehiclesInside: vehiclesInside.length,
    vehiclesList: vehiclesInside
  }, 'Lấy thống kê hàng ngày thành công');
});

// Lấy logs cần verify (pending)
export const getPendingLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);

  const [logs, total] = await Promise.all([
    AccessLog.find({ verificationStatus: 'pending' })
      .populate('vehicle', 'licensePlate vehicleType name color')
      .populate('owner', 'name username phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AccessLog.countDocuments({ verificationStatus: 'pending' })
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, logs, pagination, 'Lấy danh sách logs cần verify thành công');
});

// Lấy vehicles đang trong khuôn viên
export const getVehiclesInside = asyncHandler(async (req, res) => {
  const vehiclesInside = await AccessLog.findVehiclesInside();

  // Populate thông tin vehicle và owner
  const populatedVehicles = await AccessLog.populate(vehiclesInside, [
    { path: 'vehicle', select: 'licensePlate vehicleType name color' },
    { path: 'owner', select: 'name username phone' }
  ]);

  sendSuccessResponse(res, {
    vehicles: populatedVehicles,
    count: populatedVehicles.length
  }, 'Danh sách vehicles đang trong khuôn viên');
});

// Xóa access log (admin only)
export const deleteAccessLog = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const accessLog = await AccessLog.findById(id);
  if (!accessLog) {
    return sendErrorResponse(res, 'Không tìm thấy access log', 404);
  }

  await AccessLog.findByIdAndDelete(id);

  sendSuccessResponse(res, null, 'Xóa access log thành công');
});

// Lấy báo cáo tổng hợp
export const getReports = asyncHandler(async (req, res) => {
  const { 
    startDate, 
    endDate, 
    groupBy = 'day' // day, week, month
  } = req.query;

  if (!startDate || !endDate) {
    return sendErrorResponse(res, 'Vui lòng cung cấp startDate và endDate', 400);
  }

  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);

  // Group format based on groupBy parameter
  let groupFormat;
  switch (groupBy) {
    case 'week':
      groupFormat = { $week: '$createdAt' };
      break;
    case 'month':
      groupFormat = { $month: '$createdAt' };
      break;
    default:
      groupFormat = { $dayOfYear: '$createdAt' };
  }

  const reports = await AccessLog.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          period: groupFormat,
          year: { $year: '$createdAt' },
          action: '$action'
        },
        count: { $sum: 1 },
        uniqueVehicles: { $addToSet: '$licensePlate' },
        avgConfidence: { $avg: '$recognitionData.confidence' },
        autoApproved: {
          $sum: { $cond: [{ $eq: ['$verificationStatus', 'auto_approved'] }, 1, 0] }
        },
        manuallyApproved: {
          $sum: { $cond: [{ $eq: ['$verificationStatus', 'approved'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$verificationStatus', 'rejected'] }, 1, 0] }
        },
        guestEntries: {
          $sum: { $cond: [{ $and: [{ $eq: ['$isVehicleRegistered', false] }, { $ne: ['$guestInfo', null] }] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        period: '$_id.period',
        year: '$_id.year',
        action: '$_id.action',
        count: 1,
        uniqueVehicleCount: { $size: '$uniqueVehicles' },
        avgConfidence: { $round: ['$avgConfidence', 3] },
        autoApproved: 1,
        manuallyApproved: 1,
        rejected: 1,
        guestEntries: 1,
        approvalRate: {
          $round: [
            { $divide: [{ $add: ['$autoApproved', '$manuallyApproved'] }, '$count'] },
            3
          ]
        },
        guestRate: {
          $round: [
            { $divide: ['$guestEntries', '$count'] },
            3
          ]
        }
      }
    },
    { $sort: { year: 1, period: 1, action: 1 } }
  ]);

  sendSuccessResponse(res, { reports }, 'Lấy báo cáo thành công');
});

// Lấy thống kê giờ hành chính
export const getWorkingHoursStats = asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    userId,
    licensePlate,
    groupBy = 'day' // day, week, month
  } = req.query;

  if (!startDate || !endDate) {
    return sendErrorResponse(res, 'Vui lòng cung cấp thời gian bắt đầu và thời gian kết thúc', 400);
  }

  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);

  if (start >= end) {
    return sendErrorResponse(res, 'Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc', 400);
  }

  // Lấy tất cả cài đặt giờ làm việc active
  const workingHoursList = await WorkingHours.getActiveWorkingHours();
  if (!workingHoursList || workingHoursList.length === 0) {
    return sendErrorResponse(res, 'Chưa có cài đặt giờ làm việc nào được kích hoạt', 404);
  }

  // Build filter
  const filter = {
    createdAt: { $gte: start, $lte: end }
  };

  if (userId) {
    filter.owner = userId;
  }

  if (licensePlate) {
    filter.licensePlate = normalizeLicensePlate(licensePlate);
  }

  // Nếu user thường, chỉ xem thống kê của mình
  if (req.user.role === 'user') {
    filter.owner = req.user._id;
  }

  // Lấy các access logs
  const logs = await AccessLog.find(filter)
    .populate('owner', 'name username employeeId department')
    .populate('vehicle', 'licensePlate name')
    .sort({ createdAt: 1 });

  // Phân tích từng log
  const analysisResults = [];
  const dailyStats = {};

  logs.forEach(log => {
    const analysis = {
      logId: log._id,
      licensePlate: log.licensePlate,
      owner: log.owner,
      vehicle: log.vehicle,
      action: log.action,
      createdAt: log.createdAt,
      dayOfWeek: log.createdAt.getDay(),
      timeStr: log.createdAt.toTimeString().substring(0, 5)
    };

    // Sử dụng shift-based logic - xác định ca làm việc cụ thể
    const violationCheck = checkViolationWithShift(log, workingHoursList);
    
    Object.assign(analysis, violationCheck);
    
    analysisResults.push(analysis);

    // Tổng hợp thống kê theo ngày
    const dateKey = log.createdAt.toISOString().split('T')[0];
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = {
        date: dateKey,
        totalLogs: 0,
        entries: { total: 0, ontime: 0, late: 0 },
        exits: { total: 0, ontime: 0, early: 0 },
        uniqueVehicles: new Set()
      };
    }

    dailyStats[dateKey].totalLogs++;
    dailyStats[dateKey].uniqueVehicles.add(log.licensePlate);

    if (log.action === 'entry') {
      dailyStats[dateKey].entries.total++;
      if (analysis.status === 'late') {
        dailyStats[dateKey].entries.late++;
      } else {
        dailyStats[dateKey].entries.ontime++;
      }
    } else if (log.action === 'exit') {
      dailyStats[dateKey].exits.total++;
      if (analysis.status === 'early') {
        dailyStats[dateKey].exits.early++;
      } else {
        dailyStats[dateKey].exits.ontime++;
      }
    }
  });

  // Convert Set to count
  Object.values(dailyStats).forEach(stat => {
    stat.uniqueVehiclesCount = stat.uniqueVehicles.size;
    delete stat.uniqueVehicles;
  });

  // Tính toán summary
  const summary = {
    totalLogs: logs.length,
    dateRange: { start: startDate, end: endDate },
    workingHoursConfigs: workingHoursList.map(wh => ({
      id: wh._id,
      name: wh.name,
      startTime: wh.startTime,
      endTime: wh.endTime,
      workingDays: wh.workingDays,
      lateToleranceMinutes: wh.lateToleranceMinutes,
      earlyToleranceMinutes: wh.earlyToleranceMinutes
    })),
    entries: {
      total: analysisResults.filter(r => r.action === 'entry').length,
      ontime: analysisResults.filter(r => r.action === 'entry' && r.status === 'ontime').length,
      late: analysisResults.filter(r => r.action === 'entry' && r.status === 'late').length
    },
    exits: {
      total: analysisResults.filter(r => r.action === 'exit').length,
      ontime: analysisResults.filter(r => r.action === 'exit' && r.status === 'ontime').length,
      early: analysisResults.filter(r => r.action === 'exit' && r.status === 'early').length
    }
  };

  // Tính tỷ lệ
  if (summary.entries.total > 0) {
    summary.entries.ontimeRate = Math.round((summary.entries.ontime / summary.entries.total) * 100);
    summary.entries.lateRate = Math.round((summary.entries.late / summary.entries.total) * 100);
  }

  if (summary.exits.total > 0) {
    summary.exits.ontimeRate = Math.round((summary.exits.ontime / summary.exits.total) * 100);
    summary.exits.earlyRate = Math.round((summary.exits.early / summary.exits.total) * 100);
  }

  sendSuccessResponse(res, {
    summary,
    dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
    detailedAnalysis: analysisResults
  }, 'Lấy thống kê giờ hành chính thành công');
});

// Lấy top nhân viên đi muộn/về sớm
export const getWorkingHoursViolations = asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    violationType = 'both', // 'late', 'early', 'both'
    limit = 10,
    departmentId,
    search
  } = req.query;

  if (!startDate || !endDate) {
    return sendErrorResponse(res, 'Vui lòng cung cấp thời gian bắt đầu và thời gian kết thúc', 400);
  }

  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);

  // Lấy tất cả cài đặt giờ làm việc active
  const workingHoursList = await WorkingHours.getActiveWorkingHours();
  if (!workingHoursList || workingHoursList.length === 0) {
    return sendErrorResponse(res, 'Chưa có cài đặt giờ làm việc nào được kích hoạt', 404);
  }

  // Base Query
  const baseQuery = {
    createdAt: { $gte: start, $lte: end },
    owner: { $exists: true },
    verificationStatus: { $in: ['auto_approved', 'approved'] }
  };

  // RBAC Filter
  const departmentFilter = await createDepartmentFilter(req.user, {
    ownerField: 'owner',
    allowSelfOnly: true
  });

  // User Query Conditions (departmentId, search)
  const userQueryConditions = [];

  if (departmentId) {
    const usersInDept = await User.find({ department: departmentId }).select('_id');
    const ids = usersInDept.map(u => u._id);
    userQueryConditions.push({ owner: { $in: ids } });
  }

  if (search) {
    const normalizedPlate = normalizeLicensePlate(search);
    
    // Tìm các department khớp tên
    const matchingDepts = await Department.find({ 
      name: { $regex: search, $options: 'i' } 
    }).select('_id');
    const deptIds = matchingDepts.map(d => d._id);
    
    // Tìm users khớp tên, phone hoặc thuộc department tìm thấy
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { department: { $in: deptIds } }
      ]
    }).select('_id');
    const userIds = matchingUsers.map(u => u._id);

    userQueryConditions.push({
      $or: [
        { licensePlate: { $regex: normalizedPlate, $options: 'i' } },
        { owner: { $in: userIds } }
      ]
    });
  }

  // Combine Final Filter using $and for strict intersection
  const filter = {
    $and: [
      baseQuery,
      departmentFilter,
      ...userQueryConditions
    ]
  };

  // Nếu user thường, baseQuery/departmentFilter đã handle rồi, nhưng thêm dòng này cho rõ ràng logic cũ
  if (req.user.role === 'user') {
    // departmentFilter handles this via createDepartmentFilter options
  }

  const logs = await AccessLog.find(filter)
    .populate('owner', 'name username employeeId department')
    .populate('vehicle', 'licensePlate name')
    .sort({ createdAt: 1 });

  // Phân tích vi phạm theo user
  const userViolations = {};

  logs.forEach(log => {
    if (!log.owner) return;

    const userId = log.owner._id.toString();
    if (!userViolations[userId]) {
      userViolations[userId] = {
        user: log.owner,
        lateEntries: [],
        earlyExits: [],
        totalViolations: 0
      };
    }

    // Sử dụng shift-based logic
    const violationCheck = checkViolationWithShift(log, workingHoursList);

    if (log.action === 'entry' && violationCheck.isViolation && violationCheck.status === 'late') {
      userViolations[userId].lateEntries.push({
        logId: log._id,
        date: log.createdAt.toISOString().split('T')[0],
        time: log.createdAt.toTimeString().substring(0, 5),
        lateMinutes: violationCheck.violationMinutes,
        licensePlate: log.licensePlate,
        workingHour: violationCheck.relevantWorkingHour,
        evidenceImages: {
          processedImage: log.recognitionData?.processedImage || null,
          originalImage: log.recognitionData?.originalImage || null
        },
        videoUrl: log.recognitionData?.videoUrl || null,
        gateName: log.gateName,
        confidence: log.recognitionData?.confidence
      });
      userViolations[userId].totalViolations++;
    } else if (log.action === 'exit' && violationCheck.isViolation && violationCheck.status === 'early') {
      userViolations[userId].earlyExits.push({
        logId: log._id,
        date: log.createdAt.toISOString().split('T')[0],
        time: log.createdAt.toTimeString().substring(0, 5),
        earlyMinutes: violationCheck.violationMinutes,
        licensePlate: log.licensePlate,
        workingHour: violationCheck.relevantWorkingHour,
        evidenceImages: {
          processedImage: log.recognitionData?.processedImage || null,
          originalImage: log.recognitionData?.originalImage || null
        },
        videoUrl: log.recognitionData?.videoUrl || null,
        gateName: log.gateName,
        confidence: log.recognitionData?.confidence
      });
      userViolations[userId].totalViolations++;
    }
  });

  // Lọc và sắp xếp theo loại vi phạm
  let filteredUsers = Object.values(userViolations).filter(user => {
    if (violationType === 'late') {
      return user.lateEntries.length > 0;
    } else if (violationType === 'early') {
      return user.earlyExits.length > 0;
    }
    return user.totalViolations > 0;
  });

  // Sắp xếp theo số lần vi phạm giảm dần
  filteredUsers.sort((a, b) => b.totalViolations - a.totalViolations);

  // Giới hạn kết quả
  filteredUsers = filteredUsers.slice(0, parseInt(limit));

  // Tính thống kê tổng quan
  const summary = {
    dateRange: { start: startDate, end: endDate },
    violationType,
    workingHoursConfigs: workingHoursList.map(wh => ({
      id: wh._id,
      name: wh.name,
      startTime: wh.startTime,
      endTime: wh.endTime,
      lateToleranceMinutes: wh.lateToleranceMinutes,
      earlyToleranceMinutes: wh.earlyToleranceMinutes
    })),
    totalUsersWithViolations: filteredUsers.length,
    totalLateEntries: filteredUsers.reduce((sum, user) => sum + user.lateEntries.length, 0),
    totalEarlyExits: filteredUsers.reduce((sum, user) => sum + user.earlyExits.length, 0),
    totalViolations: filteredUsers.reduce((sum, user) => sum + user.totalViolations, 0)
  };

  sendSuccessResponse(res, {
    summary,
    violations: filteredUsers
  }, 'Lấy danh sách vi phạm giờ hành chính thành công');
});

// Lấy báo cáo chi tiết theo nhân viên
export const getUserWorkingHoursReport = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return sendErrorResponse(res, 'Vui lòng cung cấp thời gian bắt đầu và thời gian kết thúc', 400);
  }

  // Kiểm tra quyền xem báo cáo
  if (req.user.role === 'user' && req.user._id.toString() !== userId) {
    return sendErrorResponse(res, 'Không có quyền xem báo cáo của người khác', 403);
  }

  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);

  // Lấy thông tin user
  const user = await User.findById(userId);
  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy người dùng', 404);
  }

  // Lấy tất cả cài đặt giờ làm việc active
  const workingHoursList = await WorkingHours.getActiveWorkingHours();
  if (!workingHoursList || workingHoursList.length === 0) {
    return sendErrorResponse(res, 'Chưa có cài đặt giờ làm việc nào được kích hoạt', 404);
  }

  // Lấy access logs của user
  const logs = await AccessLog.find({
    owner: userId,
    createdAt: { $gte: start, $lte: end }
  })
    .populate('vehicle', 'licensePlate name')
    .sort({ createdAt: 1 });

  // Phân tích theo ngày
  const dailyReport = {};

  logs.forEach(log => {
    const dateKey = log.createdAt.toISOString().split('T')[0];
    
    if (!dailyReport[dateKey]) {
      // Kiểm tra xem ngày này có phải working day trong BẤT KỲ working hours nào không
      const isWorkingDayInAny = workingHoursList.some(wh => wh.workingDays.includes(log.createdAt.getDay()));
      
      dailyReport[dateKey] = {
        date: dateKey,
        dayOfWeek: log.createdAt.getDay(),
        isWorkingDay: isWorkingDayInAny,
        entries: [],
        exits: [],
        violations: []
      };
    }

    const timeStr = log.createdAt.toTimeString().substring(0, 5);
    
    // Sử dụng shift-based logic
    const violationCheck = checkViolationWithShift(log, workingHoursList);

    if (log.action === 'entry') {
      const entry = {
        time: timeStr,
        licensePlate: log.licensePlate,
        vehicle: log.vehicle,
        isLate: violationCheck.status === 'late',
        lateMinutes: violationCheck.violationMinutes || 0,
        hasApprovedRequest: !!log.metadata?.workingHoursRequest?.requestId,
        requestInfo: log.metadata?.workingHoursRequest || null,
        workingHour: violationCheck.relevantWorkingHour,
        status: violationCheck.status
      };
      dailyReport[dateKey].entries.push(entry);

      // Tính vi phạm
      if (violationCheck.isViolation && violationCheck.status === 'late') {
        dailyReport[dateKey].violations.push({
          type: 'late_entry',
          time: timeStr,
          minutes: violationCheck.violationMinutes,
          licensePlate: log.licensePlate,
          workingHour: violationCheck.relevantWorkingHour
        });
      }
    } else if (log.action === 'exit') {
      const exit = {
        time: timeStr,
        licensePlate: log.licensePlate,
        vehicle: log.vehicle,
        isEarly: violationCheck.status === 'early',
        earlyMinutes: violationCheck.violationMinutes || 0,
        hasApprovedRequest: !!log.metadata?.workingHoursRequest?.requestId,
        requestInfo: log.metadata?.workingHoursRequest || null,
        workingHour: violationCheck.relevantWorkingHour,
        status: violationCheck.status
      };
      dailyReport[dateKey].exits.push(exit);

      // Tính vi phạm
      if (violationCheck.isViolation && violationCheck.status === 'early') {
        dailyReport[dateKey].violations.push({
          type: 'early_exit',
          time: timeStr,
          minutes: violationCheck.violationMinutes,
          licensePlate: log.licensePlate,
          workingHour: violationCheck.relevantWorkingHour
        });
      }
    }
  });

  // Tính thống kê tổng
  const sortedDays = Object.values(dailyReport).sort((a, b) => a.date.localeCompare(b.date));
  
  const summary = {
    user: {
      name: user.name,
      username: user.username,
      employeeId: user.employeeId,
      department: user.department
    },
    dateRange: { start: startDate, end: endDate },
    workingHoursConfig: {
      name: workingHours.name,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
      workingDays: workingHours.workingDays,
      lateToleranceMinutes: workingHours.lateToleranceMinutes,
      earlyToleranceMinutes: workingHours.earlyToleranceMinutes
    },
    statistics: {
      totalDays: sortedDays.length,
      workingDays: sortedDays.filter(day => day.isWorkingDay).length,
      totalEntries: sortedDays.reduce((sum, day) => sum + day.entries.length, 0),
      totalExits: sortedDays.reduce((sum, day) => sum + day.exits.length, 0),
      lateEntries: sortedDays.reduce((sum, day) => sum + day.entries.filter(e => e.isLate).length, 0),
      earlyExits: sortedDays.reduce((sum, day) => sum + day.exits.filter(e => e.isEarly).length, 0),
      totalViolations: sortedDays.reduce((sum, day) => sum + day.violations.length, 0)
    }
  };

  // Tính tỷ lệ
  if (summary.statistics.totalEntries > 0) {
    summary.statistics.ontimeEntryRate = Math.round(
      ((summary.statistics.totalEntries - summary.statistics.lateEntries) / summary.statistics.totalEntries) * 100
    );
  }

  if (summary.statistics.totalExits > 0) {
    summary.statistics.ontimeExitRate = Math.round(
      ((summary.statistics.totalExits - summary.statistics.earlyExits) / summary.statistics.totalExits) * 100
    );
  }

  sendSuccessResponse(res, {
    summary,
    dailyReport: sortedDays
  }, `Lấy báo cáo giờ hành chính của ${user.name} thành công`);
});

// Lấy danh sách access log cần verification
export const getPendingVerificationLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { gateId, confidenceThreshold = 0.8 } = req.query;

  // Chỉ supervisor mới có quyền xem
  if (req.user.role !== 'supervisor' && req.user.role !== 'super_admin') {
    return sendErrorResponse(res, 'Không có quyền truy cập', 403);
  }

  const filter = {
    verificationStatus: 'pending',
    $or: [
      { 'recognitionData.confidence': { $lt: parseFloat(confidenceThreshold) } },
      { isVehicleRegistered: false }
    ]
  };

  if (gateId) {
    filter.gateId = gateId;
  }

  const [logs, total] = await Promise.all([
    AccessLog.find(filter)
      .populate('vehicle', 'brand model color description')
      .populate('owner', 'name username department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AccessLog.countDocuments(filter)
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, logs, pagination, 'Lấy danh sách access log cần xác minh thành công');
});

// Phê duyệt access log
export const approveAccessLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { verificationNote } = req.body;

  // Chỉ supervisor mới có quyền approve
  if (req.user.role !== 'supervisor' && req.user.role !== 'super_admin') {
    return sendErrorResponse(res, 'Không có quyền phê duyệt', 403);
  }

  const accessLog = await AccessLog.findById(id);
  
  if (!accessLog) {
    return sendErrorResponse(res, 'Không tìm thấy access log', 404);
  }

  if (accessLog.verificationStatus !== 'pending') {
    return sendErrorResponse(res, 'Access log này đã được xử lý', 400);
  }

  const previousStatus = accessLog.verificationStatus;
  accessLog.verificationStatus = 'approved';
  accessLog.verifiedBy = req.user._id;
  accessLog.verificationTime = new Date();
  
  if (verificationNote) {
    accessLog.verificationNote = verificationNote.trim();
  }

  await accessLog.save();

  // Gửi thông báo tới chủ xe
  if (socketServiceInstance) {
    try {
      await socketServiceInstance.notifyAccessLogVerified(accessLog);
    } catch (error) {
      console.error('Error sending access log verification notification:', error);
    }
  }

  const updatedLog = await AccessLog.findById(accessLog._id)
    .populate('vehicle', 'brand model color description')
    .populate('owner', 'name username department')
    .populate('verifiedBy', 'name username');

  sendSuccessResponse(res, { accessLog: updatedLog }, 'Phê duyệt access log thành công');
});

// Từ chối access log
export const rejectAccessLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { verificationNote } = req.body;

  // Chỉ supervisor mới có quyền reject
  if (req.user.role !== 'supervisor' && req.user.role !== 'super_admin') {
    return sendErrorResponse(res, 'Không có quyền từ chối', 403);
  }

  const accessLog = await AccessLog.findById(id);
  
  if (!accessLog) {
    return sendErrorResponse(res, 'Không tìm thấy access log', 404);
  }

  if (accessLog.verificationStatus !== 'pending') {
    return sendErrorResponse(res, 'Access log này đã được xử lý', 400);
  }

  const previousStatus = accessLog.verificationStatus;
  accessLog.verificationStatus = 'rejected';
  accessLog.verifiedBy = req.user._id;
  accessLog.verificationTime = new Date();
  
  if (verificationNote) {
    accessLog.verificationNote = verificationNote.trim();
  } else {
    accessLog.verificationNote = 'Từ chối xác minh';
  }

  await accessLog.save();

  // Gửi thông báo tới chủ xe
  if (socketServiceInstance) {
    try {
      await socketServiceInstance.notifyAccessLogVerified(accessLog);
    } catch (error) {
      console.error('Error sending access log verification notification:', error);
    }
  }

  const updatedLog = await AccessLog.findById(accessLog._id)
    .populate('vehicle', 'brand model color description')
    .populate('owner', 'name username department')
    .populate('verifiedBy', 'name username');

  sendSuccessResponse(res, { accessLog: updatedLog }, 'Từ chối access log thành công');
});

// Thống kê access log cần verification
export const getVerificationStats = asyncHandler(async (req, res) => {
  // Chỉ supervisor mới có quyền xem
  if (req.user.role !== 'supervisor' && req.user.role !== 'super_admin') {
    return sendErrorResponse(res, 'Không có quyền truy cập', 403);
  }

  const stats = await AccessLog.aggregate([
    {
      $group: {
        _id: '$verificationStatus',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$recognitionData.confidence' }
      }
    }
  ]);

  const lowConfidenceCount = await AccessLog.countDocuments({
    'recognitionData.confidence': { $lt: 0.8 },
    verificationStatus: 'pending'
  });

  const unregisteredVehicleCount = await AccessLog.countDocuments({
    isVehicleRegistered: false,
    verificationStatus: 'pending'
  });

  const result = {
    statusBreakdown: stats,
    pendingVerification: {
      lowConfidence: lowConfidenceCount,
      unregisteredVehicle: unregisteredVehicleCount,
      total: lowConfidenceCount + unregisteredVehicleCount
    }
  };

  sendSuccessResponse(res, result, 'Lấy thống kê verification thành công');
});
