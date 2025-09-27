import { WorkingHoursRequest, User, Vehicle, AccessLog } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { normalizeLicensePlate } from '../utils/licensePlate.js';
import { asyncHandler } from '../middleware/logger.js';

// Lấy danh sách yêu cầu ra / vào giờ hành chính
export const getWorkingHoursRequests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { 
    status, 
    requestType, 
    licensePlate, 
    startDate, 
    endDate,
    requestedBy 
  } = req.query;

  // Build filter
  const filter = {};
  
  if (status) filter.status = status;
  if (requestType) filter.requestType = requestType;
  if (licensePlate) filter.licensePlate = normalizeLicensePlate(licensePlate);
  if (requestedBy) filter.requestedBy = requestedBy;
  
  if (startDate || endDate) {
    filter.plannedDateTime = {};
    if (startDate) filter.plannedDateTime.$gte = new Date(startDate);
    if (endDate) filter.plannedDateTime.$lte = new Date(endDate);
  }

  // Nếu là user thường, chỉ xem yêu cầu của mình
  if (req.user.role === 'user') {
    filter.requestedBy = req.user._id;
  }

  const [requests, total] = await Promise.all([
    WorkingHoursRequest.find(filter)
      .populate('requestedBy', 'name username employeeId department phone')
      .populate('approvedBy', 'name username')
      .populate('relatedAccessLogs', 'action createdAt gateId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WorkingHoursRequest.countDocuments(filter)
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, requests, pagination, 'Lấy danh sách yêu cầu ra/vào giờ hành chính thành công');
});

// Lấy yêu cầu theo ID
export const getWorkingHoursRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const request = await WorkingHoursRequest.findById(id)
    .populate('requestedBy', 'name username employeeId department phone')
    .populate('approvedBy', 'name username')
    .populate('relatedAccessLogs', 'action createdAt gateId gateName');
  
  if (!request) {
    return sendErrorResponse(res, 'Không tìm thấy yêu cầu đăng ký', 404);
  }

  // Kiểm tra quyền xem
  if (req.user.role === 'user' && request.requestedBy._id.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền xem yêu cầu này', 403);
  }
  
  sendSuccessResponse(res, { request }, 'Lấy thông tin yêu cầu đăng ký thành công');
});

// Tạo yêu cầu đăng ký mới
export const createWorkingHoursRequest = asyncHandler(async (req, res) => {
  const {
    requestType,
    plannedDateTime,
    plannedEndDateTime,
    licensePlate,
    reason,
    metadata
  } = req.body;

  // Validate licensePlate thuộc về user
  const normalizedPlate = normalizeLicensePlate(licensePlate);
  const vehicle = await Vehicle.findOne({ licensePlate: normalizedPlate, owner: req.user._id });
  
  if (!vehicle) {
    return sendErrorResponse(res, 'Bạn không có quyền tạo yêu cầu cho biển số này', 403);
  }

  // Validate thời gian
  const plannedTime = new Date(plannedDateTime);
  const now = new Date();
  
  if (plannedTime <= now) {
    return sendErrorResponse(res, 'Thời gian dự kiến phải lớn hơn thời gian hiện tại', 400);
  }

  // Kiểm tra không có yêu cầu trùng lặp trong cùng khoảng thời gian
  const existingRequest = await WorkingHoursRequest.findOne({
    requestedBy: req.user._id,
    licensePlate: normalizedPlate,
    status: { $in: ['pending', 'approved'] },
    plannedDateTime: {
      $gte: new Date(plannedTime.getTime() - 2 * 60 * 60 * 1000), // 2 giờ trước
      $lte: new Date(plannedTime.getTime() + 2 * 60 * 60 * 1000)  // 2 giờ sau
    }
  });

  if (existingRequest) {
    return sendErrorResponse(res, 'Đã có yêu cầu tương tự trong khoảng thời gian này', 400);
  }

  const requestData = {
    requestedBy: req.user._id,
    requestType,
    plannedDateTime: plannedTime,
    licensePlate: normalizedPlate,
    reason: reason.trim(),
    metadata: {
      department: req.user.department,
      phoneNumber: req.user.phone,
      ...metadata
    }
  };

  if (requestType === 'both' && plannedEndDateTime) {
    requestData.plannedEndDateTime = new Date(plannedEndDateTime);
  }

  const request = new WorkingHoursRequest(requestData);
  await request.save();

  const populatedRequest = await WorkingHoursRequest.findById(request._id)
    .populate('requestedBy', 'name username employeeId department phone');

  sendSuccessResponse(res, { request: populatedRequest }, 'Tạo yêu cầu đăng ký thành công', 201);
});

// Cập nhật yêu cầu (chỉ cho user tự cập nhật yêu cầu pending của mình)
export const updateWorkingHoursRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { plannedDateTime, plannedEndDateTime, reason, metadata } = req.body;

  const request = await WorkingHoursRequest.findById(id);
  
  if (!request) {
    return sendErrorResponse(res, 'Không tìm thấy yêu cầu đăng ký', 404);
  }

  // Chỉ cho phép user sửa yêu cầu của chính mình và đang pending
  if (request.requestedBy.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền sửa yêu cầu này', 403);
  }

  if (request.status !== 'pending') {
    return sendErrorResponse(res, 'Chỉ có thể sửa yêu cầu đang chờ phê duyệt', 400);
  }

  // Update fields
  if (plannedDateTime) {
    const plannedTime = new Date(plannedDateTime);
    if (plannedTime <= new Date()) {
      return sendErrorResponse(res, 'Thời gian dự kiến phải lớn hơn thời gian hiện tại', 400);
    }
    request.plannedDateTime = plannedTime;
  }

  if (plannedEndDateTime && request.requestType === 'both') {
    request.plannedEndDateTime = new Date(plannedEndDateTime);
  }

  if (reason) {
    request.reason = reason.trim();
  }

  if (metadata) {
    request.metadata = { ...request.metadata, ...metadata };
  }

  await request.save();

  const updatedRequest = await WorkingHoursRequest.findById(request._id)
    .populate('requestedBy', 'name username employeeId department phone');

  sendSuccessResponse(res, { request: updatedRequest }, 'Cập nhật yêu cầu đăng ký thành công');
});

// Hủy yêu cầu (user tự hủy)
export const cancelWorkingHoursRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await WorkingHoursRequest.findById(id);
  
  if (!request) {
    return sendErrorResponse(res, 'Không tìm thấy yêu cầu đăng ký', 404);
  }

  if (request.requestedBy.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền hủy yêu cầu này', 403);
  }

  if (!['pending', 'approved'].includes(request.status)) {
    return sendErrorResponse(res, 'Không thể hủy yêu cầu này', 400);
  }

  request.status = 'rejected';
  request.approvalNote = 'Đã hủy bởi người tạo yêu cầu';
  await request.save();

  sendSuccessResponse(res, null, 'Hủy yêu cầu đăng ký thành công');
});

// Phê duyệt yêu cầu (admin/super admin)
export const approveWorkingHoursRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approvalNote, validHours = 24 } = req.body;

  const request = await WorkingHoursRequest.findById(id)
    .populate('requestedBy', 'name username employeeId department');
  
  if (!request) {
    return sendErrorResponse(res, 'Không tìm thấy yêu cầu đăng ký', 404);
  }

  if (request.status !== 'pending') {
    return sendErrorResponse(res, 'Chỉ có thể phê duyệt yêu cầu đang chờ phê duyệt', 400);
  }

  request.status = 'approved';
  request.approvedBy = req.user._id;
  request.approvedAt = new Date();
  request.validUntil = new Date(Date.now() + validHours * 60 * 60 * 1000);
  
  if (approvalNote) {
    request.approvalNote = approvalNote.trim();
  }

  await request.save();

  const updatedRequest = await WorkingHoursRequest.findById(request._id)
    .populate('requestedBy', 'name username employeeId department phone')
    .populate('approvedBy', 'name username');

  sendSuccessResponse(res, { request: updatedRequest }, 'Phê duyệt yêu cầu thành công');
});

// Từ chối yêu cầu (admin/super admin)
export const rejectWorkingHoursRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approvalNote } = req.body;

  const request = await WorkingHoursRequest.findById(id);
  
  if (!request) {
    return sendErrorResponse(res, 'Không tìm thấy yêu cầu đăng ký', 404);
  }

  if (request.status !== 'pending') {
    return sendErrorResponse(res, 'Chỉ có thể từ chối yêu cầu đang chờ phê duyệt', 400);
  }

  request.status = 'rejected';
  request.approvedBy = req.user._id;
  request.approvedAt = new Date();
  
  if (approvalNote) {
    request.approvalNote = approvalNote.trim();
  }

  await request.save();

  const updatedRequest = await WorkingHoursRequest.findById(request._id)
    .populate('requestedBy', 'name username employeeId department phone')
    .populate('approvedBy', 'name username');

  sendSuccessResponse(res, { request: updatedRequest }, 'Từ chối yêu cầu thành công');
});

// Lấy yêu cầu đang chờ phê duyệt
export const getPendingRequests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);

  const [requests, total] = await Promise.all([
    WorkingHoursRequest.find({ status: 'pending' })
      .populate('requestedBy', 'name username employeeId department phone')
      .sort({ createdAt: 1 }) // FIFO - First In, First Out
      .skip(skip)
      .limit(limit),
    WorkingHoursRequest.countDocuments({ status: 'pending' })
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, requests, pagination, 'Lấy danh sách yêu cầu chờ phê duyệt thành công');
});

// Lấy thống kê yêu cầu đăng ký
export const getRequestsStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const stats = await WorkingHoursRequest.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        requestTypes: { $push: '$requestType' }
      }
    }
  ]);

  const typeStats = await WorkingHoursRequest.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$requestType',
        count: { $sum: 1 }
      }
    }
  ]);

  const totalRequests = await WorkingHoursRequest.countDocuments(filter);

  sendSuccessResponse(res, {
    totalRequests,
    statusStats: stats,
    typeStats: typeStats,
    dateRange: { startDate, endDate }
  }, 'Lấy thống kê yêu cầu đăng ký thành công');
});

// Kiểm tra và áp dụng yêu cầu cho access log
export const checkAndApplyRequest = async (accessLog) => {
  try {
    // Auto expire các yêu cầu hết hạn
    await WorkingHoursRequest.autoExpireRequests();
    
    // Tìm yêu cầu có thể áp dụng
    const applicableRequest = await WorkingHoursRequest.findApplicableRequest(accessLog);
    
    if (applicableRequest) {
      // Đánh dấu yêu cầu đã được sử dụng
      await applicableRequest.markAsUsed(accessLog._id);
      
      // Trả về thông tin để có thể bỏ qua kiểm tra vi phạm giờ hành chính
      return {
        hasValidRequest: true,
        requestId: applicableRequest._id,
        requestedBy: applicableRequest.requestedBy,
        reason: applicableRequest.reason,
        approvedBy: applicableRequest.approvedBy,
        approvedAt: applicableRequest.approvedAt
      };
    }
    
    return { hasValidRequest: false };
  } catch (error) {
    console.error('Lỗi khi kiểm tra yêu cầu đăng ký:', error);
    return { hasValidRequest: false, error: error.message };
  }
};

