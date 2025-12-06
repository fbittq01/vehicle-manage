import { Vehicle, User, Department } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { normalizeLicensePlate, validateVietnameseLicensePlate } from '../utils/licensePlate.js';
import { asyncHandler } from '../middleware/logger.js';
import { createDepartmentFilter, checkResourceAccess } from '../utils/departmentFilter.js';
import { getVehicleStatsByDepartment } from '../utils/departmentStats.js';

// Lấy danh sách vehicles
export const getVehicles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { vehicleType, isActive, search, owner } = req.query;

  // Build base query filter
  const baseFilter = {};
  
  if (vehicleType) baseFilter.vehicleType = vehicleType;
  if (isActive !== undefined) baseFilter.isActive = isActive === 'true';
  if (owner) baseFilter.owner = owner;
  
  if (search) {
    const normalizedSearch = normalizeLicensePlate(search);
    baseFilter.$or = [
      { licensePlate: { $regex: normalizedSearch, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { color: { $regex: search, $options: 'i' } }
    ];
  }

  try {
    // Tạo department filter
    const departmentFilter = await createDepartmentFilter(req.user, {
      ownerField: 'owner',
      allowSelfOnly: true
    });

    const filter = { ...baseFilter, ...departmentFilter };

    // Execute query
    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .populate({
          path: 'owner',
          select: 'name username phone department',
          populate: {
            path: 'department',
            select: 'name code'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vehicle.countDocuments(filter)
    ]);

    const pagination = createPagination(page, limit, total);

    sendPaginatedResponse(res, vehicles, pagination, 'Lấy danh sách vehicles thành công');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});

// Lấy thông tin vehicle theo ID
export const getVehicleById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id).populate({
    path: 'owner',
    select: 'name username phone department',
    populate: {
      path: 'department',
      select: 'name code'
    }
  });
  
  if (!vehicle) {
    return sendErrorResponse(res, 'Không tìm thấy vehicle', 404);
  }

  // Kiểm tra quyền truy cập
  const hasAccess = await checkResourceAccess(req.user, vehicle, 'owner');
  if (!hasAccess) {
    return sendErrorResponse(res, 'Không có quyền xem vehicle này', 403);
  }

  sendSuccessResponse(res, { vehicle }, 'Lấy thông tin vehicle thành công');
});

// Lấy vehicles theo biển số
export const getVehicleByLicensePlate = asyncHandler(async (req, res) => {
  const { licensePlate } = req.params;
  
  const normalizedPlate = normalizeLicensePlate(licensePlate);
  
  if (!validateVietnameseLicensePlate(normalizedPlate)) {
    return sendErrorResponse(res, 'Biển số xe không hợp lệ', 400);
  }

  const vehicle = await Vehicle.findOne({ 
    licensePlate: normalizedPlate,
    isActive: true 
  }).populate({
    path: 'owner',
    select: 'name username phone department',
    populate: {
      path: 'department',
      select: 'name code'
    }
  });

  if (!vehicle) {
    return sendErrorResponse(res, 'Không tìm thấy vehicle với biển số này', 404);
  }

  // Kiểm tra quyền truy cập
  if (req.user.role === 'user' && vehicle.owner._id.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền xem vehicle này', 403);
  }

  sendSuccessResponse(res, { vehicle }, 'Lấy thông tin vehicle thành công');
});

// Tạo vehicle mới
export const createVehicle = asyncHandler(async (req, res) => {
  const { licensePlate, owner, vehicleType, name, color, description, expiryDate } = req.body;

  // Chuẩn hóa biển số
  const normalizedPlate = normalizeLicensePlate(licensePlate);
  
  if (!validateVietnameseLicensePlate(normalizedPlate)) {
    return sendErrorResponse(res, 'Biển số xe không hợp lệ', 400);
  }

  // Kiểm tra biển số đã tồn tại
  const existingVehicle = await Vehicle.findOne({ licensePlate: normalizedPlate });
  if (existingVehicle) {
    return sendErrorResponse(res, 'Biển số xe đã tồn tại', 400);
  }

  // Kiểm tra owner có tồn tại
  const ownerUser = await User.findById(owner);
  if (!ownerUser) {
    return sendErrorResponse(res, 'Không tìm thấy chủ sở hữu', 404);
  }

  // User thường chỉ có thể tạo xe cho chính mình
  if (req.user.role === 'user' && owner !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Chỉ có thể tạo xe cho chính mình', 403);
  }

  const vehicle = new Vehicle({
    licensePlate: normalizedPlate,
    owner,
    vehicleType,
    name,
    color,
    description,
    expiryDate
  });

  await vehicle.save();
  
  const populatedVehicle = await Vehicle.findById(vehicle._id)
    .populate({
      path: 'owner',
      select: 'name username phone department',
      populate: {
        path: 'department',
        select: 'name code'
      }
    });

  sendSuccessResponse(res, { vehicle: populatedVehicle }, 'Tạo vehicle thành công', 201);
});

// Cập nhật vehicle
export const updateVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const vehicle = await Vehicle.findById(id);
  if (!vehicle) {
    return sendErrorResponse(res, 'Không tìm thấy vehicle', 404);
  }

  // Kiểm tra quyền cập nhật
  if (req.user.role === 'user' && vehicle.owner.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền cập nhật vehicle này', 403);
  }

  // Nếu cập nhật biển số, kiểm tra format và duplicate
  if (updateData.licensePlate) {
    const normalizedPlate = normalizeLicensePlate(updateData.licensePlate);
    
    if (!validateVietnameseLicensePlate(normalizedPlate)) {
      return sendErrorResponse(res, 'Biển số xe không hợp lệ', 400);
    }

    // Kiểm tra biển số mới đã tồn tại (trừ vehicle hiện tại)
    const existingVehicle = await Vehicle.findOne({ 
      licensePlate: normalizedPlate,
      _id: { $ne: id }
    });
    
    if (existingVehicle) {
      return sendErrorResponse(res, 'Biển số xe đã tồn tại', 400);
    }

    updateData.licensePlate = normalizedPlate;
  }

  // Nếu cập nhật owner, kiểm tra user có tồn tại
  if (updateData.owner) {
    // User thường không thể thay đổi owner
    if (req.user.role === 'user') {
      return sendErrorResponse(res, 'Không có quyền thay đổi chủ sở hữu', 403);
    }

    const ownerUser = await User.findById(updateData.owner);
    if (!ownerUser) {
      return sendErrorResponse(res, 'Không tìm thấy chủ sở hữu mới', 404);
    }
  }

  const updatedVehicle = await Vehicle.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate({
    path: 'owner',
    select: 'name username phone department',
    populate: {
      path: 'department',
      select: 'name code'
    }
  });

  sendSuccessResponse(res, { vehicle: updatedVehicle }, 'Cập nhật vehicle thành công');
});

// Xóa vehicle (deactivate)
export const deleteVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id);
  if (!vehicle) {
    return sendErrorResponse(res, 'Không tìm thấy vehicle', 404);
  }

  // Kiểm tra quyền xóa
  if (req.user.role === 'user' && vehicle.owner.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền xóa vehicle này', 403);
  }

  // Deactivate thay vì xóa hoàn toàn
  vehicle.isActive = false;
  await vehicle.save();

  sendSuccessResponse(res, null, 'Đã vô hiệu hóa vehicle');
});

// Kích hoạt lại vehicle
export const activateVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id);
  if (!vehicle) {
    return sendErrorResponse(res, 'Không tìm thấy vehicle', 404);
  }

  // Kiểm tra quyền kích hoạt
  if (req.user.role === 'user' && vehicle.owner.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền kích hoạt vehicle này', 403);
  }

  vehicle.isActive = true;
  await vehicle.save();

  const populatedVehicle = await Vehicle.findById(vehicle._id)
    .populate({
      path: 'owner',
      select: 'name username phone department',
      populate: {
        path: 'department',
        select: 'name code'
      }
    });

  sendSuccessResponse(res, { vehicle: populatedVehicle }, 'Đã kích hoạt vehicle');
});

// Lấy vehicles của user hiện tại
export const getMyVehicles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { vehicleType, isActive } = req.query;

  const filter = { owner: req.user._id };
  
  if (vehicleType) filter.vehicleType = vehicleType;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const [vehicles, total] = await Promise.all([
    Vehicle.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Vehicle.countDocuments(filter)
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, vehicles, pagination, 'Lấy danh sách vehicles của bạn thành công');
});

// Thống kê vehicles
export const getVehicleStats = asyncHandler(async (req, res) => {
  try {
    const stats = await getVehicleStatsByDepartment(req.user);
    sendSuccessResponse(res, stats, 'Lấy thống kê vehicles thành công');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});
