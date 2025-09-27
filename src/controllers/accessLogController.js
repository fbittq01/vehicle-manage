import { AccessLog, Vehicle, User, WorkingHours, WorkingHoursRequest } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { normalizeLicensePlate } from '../utils/licensePlate.js';
import { asyncHandler } from '../middleware/logger.js';
import { processRecognitionImages } from '../utils/fileStorage.js';
import { checkAndApplyRequest } from './workingHoursRequestController.js';

// Lấy danh sách access logs
export const getAccessLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { 
    action, 
    verificationStatus, 
    gateId, 
    licensePlate, 
    startDate, 
    endDate,
    isVehicleRegistered 
  } = req.query;

  // Build query filter
  const filter = {};
  
  if (action) filter.action = action;
  if (verificationStatus) filter.verificationStatus = verificationStatus;
  if (gateId) filter.gateId = gateId;
  if (isVehicleRegistered !== undefined) filter.isVehicleRegistered = isVehicleRegistered === 'true';
  
  if (licensePlate) {
    filter.licensePlate = normalizeLicensePlate(licensePlate);
  }
  
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  // Nếu là user thường, chỉ xem logs của xe mình
  if (req.user.role === 'user') {
    filter.owner = req.user._id;
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
});

// Lấy access log theo ID
export const getAccessLogById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const log = await AccessLog.findById(id)
    .populate('vehicle', 'licensePlate vehicleType name color owner')
    .populate('owner', 'name username phone department')
    .populate('verifiedBy', 'name username');
  
  if (!log) {
    return sendErrorResponse(res, 'Không tìm thấy access log', 404);
  }

  // Kiểm tra quyền truy cập
  if (req.user.role === 'user' && log.owner?._id.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền xem log này', 403);
  }

  sendSuccessResponse(res, { log }, 'Lấy thông tin access log thành công');
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
    weather
  });

  // Auto-approve nếu confidence cao và vehicle đã đăng ký
  if (recognitionData.confidence >= 0.9 && vehicle && vehicle.owner.isActive) {
    accessLog.verificationStatus = 'auto_approved';
    accessLog.verificationTime = new Date();
    accessLog.verificationNote = `Auto-approved với confidence ${recognitionData.confidence}`;
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
  const { status, note, guestInfo } = req.body;

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

  accessLog.verificationStatus = status;
  accessLog.verifiedBy = req.user._id;
  accessLog.verificationTime = new Date();
  accessLog.verificationNote = note;

  // Thêm thông tin khách nếu xe chưa đăng ký và được approve
  if (status === 'approved' && !accessLog.isVehicleRegistered && guestInfo) {
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

  const start = new Date(startDate);
  const end = new Date(endDate);

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

  const start = new Date(startDate);
  const end = new Date(endDate);

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

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    return sendErrorResponse(res, 'Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc', 400);
  }

  // Lấy cài đặt giờ làm việc active
  const workingHours = await WorkingHours.getActiveWorkingHours();
  if (!workingHours) {
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

    // Kiểm tra có phải ngày làm việc không
    const workingTimeCheck = workingHours.isWorkingTime(log.createdAt);
    analysis.workingTimeCheck = workingTimeCheck;

    // Kiểm tra có yêu cầu đăng ký được phê duyệt không
    const hasApprovedRequest = log.metadata?.workingHoursRequest?.requestId;
    analysis.hasApprovedRequest = !!hasApprovedRequest;
    if (hasApprovedRequest) {
      analysis.approvedRequestInfo = log.metadata.workingHoursRequest;
    }

    if (log.action === 'entry') {
      const lateCheck = workingHours.isLate(log.createdAt);
      analysis.lateCheck = lateCheck;
      // Nếu có yêu cầu được phê duyệt, không tính là vi phạm
      analysis.status = (lateCheck.isLate && !hasApprovedRequest) ? 'late' : 'ontime';
      analysis.isViolation = lateCheck.isLate && !hasApprovedRequest;
    } else if (log.action === 'exit') {
      const earlyCheck = workingHours.isEarly(log.createdAt);
      analysis.earlyCheck = earlyCheck;
      // Nếu có yêu cầu được phê duyệt, không tính là vi phạm
      analysis.status = (earlyCheck.isEarly && !hasApprovedRequest) ? 'early' : 'ontime';
      analysis.isViolation = earlyCheck.isEarly && !hasApprovedRequest;
    }

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
    workingHoursConfig: {
      name: workingHours.name,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
      workingDays: workingHours.workingDays,
      lateToleranceMinutes: workingHours.lateToleranceMinutes,
      earlyToleranceMinutes: workingHours.earlyToleranceMinutes
    },
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
    limit = 10
  } = req.query;

  if (!startDate || !endDate) {
    return sendErrorResponse(res, 'Vui lòng cung cấp thời gian bắt đầu và thời gian kết thúc', 400);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Lấy cài đặt giờ làm việc active
  const workingHours = await WorkingHours.getActiveWorkingHours();
  if (!workingHours) {
    return sendErrorResponse(res, 'Chưa có cài đặt giờ làm việc nào được kích hoạt', 404);
  }

  const filter = {
    createdAt: { $gte: start, $lte: end },
    owner: { $exists: true }
  };

  // Nếu user thường, chỉ xem vi phạm của mình
  if (req.user.role === 'user') {
    filter.owner = req.user._id;
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

    if (log.action === 'entry') {
      const lateCheck = workingHours.isLate(log.createdAt);
      // Chỉ tính vi phạm nếu muộn giờ và không có yêu cầu đăng ký được phê duyệt
      const hasApprovedRequest = log.metadata?.workingHoursRequest?.requestId;
      if (lateCheck.isLate && !hasApprovedRequest) {
        userViolations[userId].lateEntries.push({
          date: log.createdAt.toISOString().split('T')[0],
          time: log.createdAt.toTimeString().substring(0, 5),
          lateMinutes: lateCheck.lateMinutes,
          licensePlate: log.licensePlate
        });
        userViolations[userId].totalViolations++;
      }
    } else if (log.action === 'exit') {
      const earlyCheck = workingHours.isEarly(log.createdAt);
      // Chỉ tính vi phạm nếu về sớm và không có yêu cầu đăng ký được phê duyệt
      const hasApprovedRequest = log.metadata?.workingHoursRequest?.requestId;
      if (earlyCheck.isEarly && !hasApprovedRequest) {
        userViolations[userId].earlyExits.push({
          date: log.createdAt.toISOString().split('T')[0],
          time: log.createdAt.toTimeString().substring(0, 5),
          earlyMinutes: earlyCheck.earlyMinutes,
          licensePlate: log.licensePlate
        });
        userViolations[userId].totalViolations++;
      }
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
    workingHoursConfig: {
      name: workingHours.name,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
      lateToleranceMinutes: workingHours.lateToleranceMinutes,
      earlyToleranceMinutes: workingHours.earlyToleranceMinutes
    },
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

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Lấy thông tin user
  const user = await User.findById(userId);
  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy người dùng', 404);
  }

  // Lấy cài đặt giờ làm việc active
  const workingHours = await WorkingHours.getActiveWorkingHours();
  if (!workingHours) {
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
      dailyReport[dateKey] = {
        date: dateKey,
        dayOfWeek: log.createdAt.getDay(),
        isWorkingDay: workingHours.workingDays.includes(log.createdAt.getDay()),
        entries: [],
        exits: [],
        violations: []
      };
    }

    const timeStr = log.createdAt.toTimeString().substring(0, 5);
    const hasApprovedRequest = log.metadata?.workingHoursRequest?.requestId;

    if (log.action === 'entry') {
      const lateCheck = workingHours.isLate(log.createdAt);
      const entry = {
        time: timeStr,
        licensePlate: log.licensePlate,
        vehicle: log.vehicle,
        isLate: lateCheck.isLate,
        lateMinutes: lateCheck.lateMinutes || 0,
        hasApprovedRequest: !!hasApprovedRequest,
        requestInfo: hasApprovedRequest ? log.metadata.workingHoursRequest : null
      };
      dailyReport[dateKey].entries.push(entry);

      // Chỉ tính vi phạm nếu muộn giờ và không có yêu cầu đăng ký được phê duyệt
      if (lateCheck.isLate && !hasApprovedRequest) {
        dailyReport[dateKey].violations.push({
          type: 'late_entry',
          time: timeStr,
          minutes: lateCheck.lateMinutes,
          licensePlate: log.licensePlate
        });
      }
    } else if (log.action === 'exit') {
      const earlyCheck = workingHours.isEarly(log.createdAt);
      const exit = {
        time: timeStr,
        licensePlate: log.licensePlate,
        vehicle: log.vehicle,
        isEarly: earlyCheck.isEarly,
        earlyMinutes: earlyCheck.earlyMinutes || 0,
        hasApprovedRequest: !!hasApprovedRequest,
        requestInfo: hasApprovedRequest ? log.metadata.workingHoursRequest : null
      };
      dailyReport[dateKey].exits.push(exit);

      // Chỉ tính vi phạm nếu về sớm và không có yêu cầu đăng ký được phê duyệt
      if (earlyCheck.isEarly && !hasApprovedRequest) {
        dailyReport[dateKey].violations.push({
          type: 'early_exit',
                    time: timeStr,
          minutes: earlyCheck.earlyMinutes,
          licensePlate: log.licensePlate
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
