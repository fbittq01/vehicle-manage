import { WorkingHours, User } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { asyncHandler } from '../middleware/logger.js';
import { createDepartmentFilter, checkResourceAccess } from '../utils/departmentFilter.js';

// Lấy danh sách cài đặt giờ làm việc
export const getWorkingHours = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { isActive } = req.query;
  
  const baseFilter = {};
  if (isActive !== undefined) baseFilter.isActive = isActive === 'true';
  
  try {
    // Tạo department filter
    const departmentFilter = await createDepartmentFilter(req.user, {
      ownerField: 'createdBy',
      allowSelfOnly: false // Admin và user đều xem working hours của department
    });

    const filter = { ...baseFilter, ...departmentFilter };
    
    const [workingHours, total] = await Promise.all([
      WorkingHours.find(filter)
        .populate('createdBy', 'name username')
        .sort({ isActive: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WorkingHours.countDocuments(filter)
    ]);
    
    const pagination = createPagination(page, limit, total);
    
    sendPaginatedResponse(res, workingHours, pagination, 'Lấy danh sách cài đặt giờ làm việc thành công');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});

// Lấy cài đặt giờ làm việc theo ID
export const getWorkingHoursById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const workingHours = await WorkingHours.findById(id)
    .populate('createdBy', 'name username');
  
  if (!workingHours) {
    return sendErrorResponse(res, 'Không tìm thấy cài đặt giờ làm việc', 404);
  }

  // Kiểm tra quyền truy cập
  const hasAccess = await checkResourceAccess(req.user, workingHours, 'createdBy');
  if (!hasAccess) {
    return sendErrorResponse(res, 'Không có quyền xem cài đặt giờ làm việc này', 403);
  }
  
  sendSuccessResponse(res, { workingHours }, 'Lấy thông tin cài đặt giờ làm việc thành công');
});

// Lấy cài đặt giờ làm việc đang hoạt động
export const getActiveWorkingHours = asyncHandler(async (req, res) => {
  const workingHours = await WorkingHours.getActiveWorkingHours();
  
  if (!workingHours) {
    return sendErrorResponse(res, 'Chưa có cài đặt giờ làm việc nào được kích hoạt', 404);
  }
  
  sendSuccessResponse(res, { workingHours }, 'Lấy cài đặt giờ làm việc đang hoạt động thành công');
});

// Tạo cài đặt giờ làm việc mới
export const createWorkingHours = asyncHandler(async (req, res) => {
  const {
    name,
    startTime,
    endTime,
    workingDays,
    lateToleranceMinutes,
    earlyToleranceMinutes,
    description
  } = req.body;
  
  // Validate working days
  if (!Array.isArray(workingDays) || workingDays.length === 0) {
    return sendErrorResponse(res, 'Ngày làm việc phải là mảng và không được rỗng', 400);
  }
  
  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return sendErrorResponse(res, 'Định dạng thời gian không hợp lệ (HH:mm)', 400);
  }
  
  // Validate start time < end time
  if (startTime >= endTime) {
    return sendErrorResponse(res, 'Giờ bắt đầu phải nhỏ hơn giờ kết thúc', 400);
  }
  
  // Nếu tạo cài đặt mới và muốn active, deactivate tất cả cài đặt cũ
  if (req.body.isActive === true) {
    await WorkingHours.updateMany({}, { isActive: false });
  }
  
  const workingHours = new WorkingHours({
    name,
    startTime,
    endTime,
    workingDays,
    lateToleranceMinutes: lateToleranceMinutes || 30,
    earlyToleranceMinutes: earlyToleranceMinutes || 30,
    description,
    isActive: req.body.isActive || false,
    createdBy: req.user._id
  });
  
  await workingHours.save();
  
  const populatedWorkingHours = await WorkingHours.findById(workingHours._id)
    .populate('createdBy', 'name username');
  
  sendSuccessResponse(res, { workingHours: populatedWorkingHours }, 'Tạo cài đặt giờ làm việc thành công', 201);
});

// Cập nhật cài đặt giờ làm việc
export const updateWorkingHours = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    startTime,
    endTime,
    workingDays,
    lateToleranceMinutes,
    earlyToleranceMinutes,
    description,
    isActive
  } = req.body;
  
  const workingHours = await WorkingHours.findById(id);
  if (!workingHours) {
    return sendErrorResponse(res, 'Không tìm thấy cài đặt giờ làm việc', 404);
  }
  
  // Validate time format if provided
  if (startTime || endTime) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const newStartTime = startTime || workingHours.startTime;
    const newEndTime = endTime || workingHours.endTime;
    
    if (!timeRegex.test(newStartTime) || !timeRegex.test(newEndTime)) {
      return sendErrorResponse(res, 'Định dạng thời gian không hợp lệ (HH:mm)', 400);
    }
    
    if (newStartTime >= newEndTime) {
      return sendErrorResponse(res, 'Giờ bắt đầu phải nhỏ hơn giờ kết thúc', 400);
    }
  }
  
  // Validate working days if provided
  if (workingDays) {
    if (!Array.isArray(workingDays) || workingDays.length === 0) {
      return sendErrorResponse(res, 'Ngày làm việc phải là mảng và không được rỗng', 400);
    }
  }
  
  // Nếu active cài đặt này, deactivate tất cả cài đặt khác
  if (isActive === true && !workingHours.isActive) {
    await WorkingHours.updateMany({ _id: { $ne: id } }, { isActive: false });
  }
  
  // Update fields
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (startTime !== undefined) updateData.startTime = startTime;
  if (endTime !== undefined) updateData.endTime = endTime;
  if (workingDays !== undefined) updateData.workingDays = workingDays;
  if (lateToleranceMinutes !== undefined) updateData.lateToleranceMinutes = lateToleranceMinutes;
  if (earlyToleranceMinutes !== undefined) updateData.earlyToleranceMinutes = earlyToleranceMinutes;
  if (description !== undefined) updateData.description = description;
  if (isActive !== undefined) updateData.isActive = isActive;
  
  const updatedWorkingHours = await WorkingHours.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate('createdBy', 'name username');
  
  sendSuccessResponse(res, { workingHours: updatedWorkingHours }, 'Cập nhật cài đặt giờ làm việc thành công');
});

// Xóa cài đặt giờ làm việc
export const deleteWorkingHours = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const workingHours = await WorkingHours.findById(id);
  if (!workingHours) {
    return sendErrorResponse(res, 'Không tìm thấy cài đặt giờ làm việc', 404);
  }
  
  // Không cho phép xóa cài đặt đang hoạt động
  if (workingHours.isActive) {
    return sendErrorResponse(res, 'Không thể xóa cài đặt giờ làm việc đang hoạt động', 400);
  }
  
  await WorkingHours.findByIdAndDelete(id);
  
  sendSuccessResponse(res, null, 'Xóa cài đặt giờ làm việc thành công');
});

// Kích hoạt cài đặt giờ làm việc
export const activateWorkingHours = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const workingHours = await WorkingHours.findById(id);
  if (!workingHours) {
    return sendErrorResponse(res, 'Không tìm thấy cài đặt giờ làm việc', 404);
  }
  
  if (workingHours.isActive) {
    return sendErrorResponse(res, 'Cài đặt giờ làm việc đã được kích hoạt', 400);
  }
  
  // Deactivate tất cả cài đặt khác
  await WorkingHours.updateMany({}, { isActive: false });
  
  // Activate cài đặt hiện tại
  workingHours.isActive = true;
  await workingHours.save();
  
  const populatedWorkingHours = await WorkingHours.findById(workingHours._id)
    .populate('createdBy', 'name username');
  
  sendSuccessResponse(res, { workingHours: populatedWorkingHours }, 'Kích hoạt cài đặt giờ làm việc thành công');
});

// Kiểm tra thời gian có phải giờ làm việc không
export const checkWorkingTime = asyncHandler(async (req, res) => {
  const { dateTime } = req.query;
  
  if (!dateTime) {
    return sendErrorResponse(res, 'Vui lòng cung cấp dateTime', 400);
  }
  
  const workingHours = await WorkingHours.getActiveWorkingHours();
  if (!workingHours) {
    return sendErrorResponse(res, 'Chưa có cài đặt giờ làm việc nào được kích hoạt', 404);
  }
  
  const result = workingHours.isWorkingTime(dateTime);
  
  sendSuccessResponse(res, {
    dateTime: new Date(dateTime),
    workingHours: {
      name: workingHours.name,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
      workingDays: workingHours.workingDays
    },
    result
  }, 'Kiểm tra giờ làm việc thành công');
});
