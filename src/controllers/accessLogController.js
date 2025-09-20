import { AccessLog, Vehicle, User } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { normalizeLicensePlate } from '../utils/licensePlate.js';
import { asyncHandler } from '../middleware/logger.js';
import socketService from '../socket/socketService.js';

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
      .populate('owner', 'name email phone')
      .populate('verifiedBy', 'name email')
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
    .populate('owner', 'name email phone department')
    .populate('verifiedBy', 'name email');
  
  if (!log) {
    return sendErrorResponse(res, 'Không tìm thấy access log', 404);
  }

  // Kiểm tra quyền truy cập
  if (req.user.role === 'user' && log.owner?._id.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền xem log này', 403);
  }

  sendSuccessResponse(res, { log }, 'Lấy thông tin access log thành công');
});

// Tạo access log mới (từ AI system)
export const createAccessLog = asyncHandler(async (req, res) => {
  const {
    licensePlate,
    action,
    gateId,
    gateName,
    recognitionData,
    deviceInfo,
    weather
  } = req.body;

  // Chuẩn hóa biển số
  const normalizedPlate = normalizeLicensePlate(licensePlate);

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
    recognitionData,
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

  // Populate để trả về đầy đủ thông tin
  const populatedLog = await AccessLog.findById(accessLog._id)
    .populate('vehicle', 'licensePlate vehicleType name color')
    .populate('owner', 'name email phone')
    .populate('verifiedBy', 'name email');

  // Broadcast qua socket
  const responseData = {
    accessLog: populatedLog,
    vehicle,
    needsManualVerification: accessLog.verificationStatus === 'pending'
  };

  // Gửi tới specific gate
  socketService.sendToRoom(`gate_${gateId}`, 'vehicle_detected', responseData);
  
  // Gửi tới vehicle owner nếu có
  if (vehicle) {
    socketService.sendToRoom(`vehicle_${vehicle._id}`, 'vehicle_activity', responseData);
  }

  // Gửi tới admin nếu cần manual verification
  if (accessLog.verificationStatus === 'pending') {
    socketService.broadcast('manual_verification_needed', responseData);
  }

  sendSuccessResponse(res, { log: populatedLog }, 'Tạo access log thành công', 201);
});

// Verify access log (admin only)
export const verifyAccessLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

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

  await accessLog.save();

  const populatedLog = await AccessLog.findById(accessLog._id)
    .populate('vehicle', 'licensePlate vehicleType name color')
    .populate('owner', 'name email phone')
    .populate('verifiedBy', 'name email');

  // Broadcast verification result
  socketService.broadcast('verification_completed', {
    accessLog: populatedLog,
    verifiedBy: req.user
  });

  sendSuccessResponse(res, { log: populatedLog }, 'Verify access log thành công');
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
      .populate('owner', 'name email phone')
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
    { path: 'owner', select: 'name email phone' }
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
        approvalRate: {
          $round: [
            { $divide: [{ $add: ['$autoApproved', '$manuallyApproved'] }, '$count'] },
            3
          ]
        }
      }
    },
    { $sort: { year: 1, period: 1, action: 1 } }
  ]);

  sendSuccessResponse(res, { reports }, 'Lấy báo cáo thành công');
});
