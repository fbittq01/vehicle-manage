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
  const { vehicleType, isActive, search, owner, departmentId } = req.query;

  // Build base query filter
  const baseFilter = {
    isActive: true // Chỉ lấy phương tiện đang hoạt động
  };
  
  if (vehicleType) baseFilter.vehicleType = vehicleType;
  // Cho phép admin/manager xem cả phương tiện không active nếu cần
  if (isActive !== undefined && ['admin', 'manager'].includes(req.user.role)) {
    baseFilter.isActive = isActive === 'true';
  }
  if (owner) baseFilter.owner = owner;

  if (departmentId) {
    const departmentUsers = await User.find({ department: departmentId }).select('_id');
    const departmentUserIds = departmentUsers.map(u => u._id);

    if (baseFilter.owner) {
      // Nếu đã có filter owner, kiểm tra xem owner đó có thuộc department này không
      const isOwnerInDept = departmentUserIds.some(id => id.toString() === baseFilter.owner.toString());
      if (!isOwnerInDept) {
        // Owner không thuộc department -> không tìm thấy kết quả
        baseFilter.owner = { $in: [] };
      }
    } else {
      baseFilter.owner = { $in: departmentUserIds };
    }
  }
  
  if (search) {
    const normalizedSearch = normalizeLicensePlate(search);
    
    // Tìm các users thuộc department có tên khớp với từ khóa tìm kiếm
    const matchingDepartments = await Department.find({
      name: { $regex: search, $options: 'i' }
    }).select('_id');
    
    const departmentIds = matchingDepartments.map(dept => dept._id);
    
    const matchingUsers = await User.find({
      department: { $in: departmentIds }
    }).select('_id');
    
    const matchingUserIds = matchingUsers.map(user => user._id);

    baseFilter.$or = [
      { licensePlate: { $regex: normalizedSearch, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { color: { $regex: search, $options: 'i' } },
      { owner: { $in: matchingUserIds } }
    ];
  }

  try {
    // Tạo department filter
    const departmentFilter = await createDepartmentFilter(req.user, {
      ownerField: 'owner',
      allowSelfOnly: true
    });

    // Sử dụng $and để đảm bảo cả baseFilter (từ query) và departmentFilter (từ RBAC) đều được áp dụng
    // Điều này quan trọng để đảm bảo logic "check department" không bị override bởi RBAC
    const filter = {
      $and: [
        baseFilter,
        departmentFilter
      ]
    };

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
  const existingVehicle = await Vehicle.findOne({ licensePlate: normalizedPlate, isActive: true });
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

  sendSuccessResponse(res, { vehicle: updatedVehicle }, 'Cập nhật phương tiện thành công');
});

// Xóa vehicle (deactivate)
export const deleteVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Chỉ admin và manager mới có quyền xóa
  if (req.user.role === 'user') {
    return sendErrorResponse(res, 'Không có quyền xóa phương tiện. Chỉ admin hoặc manager mới có thể xóa.', 403);
  }

  const vehicle = await Vehicle.findById(id);
  if (!vehicle) {
    return sendErrorResponse(res, 'Không tìm thấy phương tiện', 404);
  }

  // Deactivate thay vì xóa hoàn toàn
  vehicle.isActive = false;
  await vehicle.save();

  sendSuccessResponse(res, null, 'Đã xoá phương tiện');
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
    return sendErrorResponse(res, 'Không có quyền kích hoạt phương tiện này', 403);
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

  sendSuccessResponse(res, { vehicle: populatedVehicle }, 'Đã kích hoạt phương tiện');
});

// Lấy vehicles của user hiện tại
export const getMyVehicles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { vehicleType, isActive } = req.query;

  const filter = { 
    owner: req.user._id,
    isActive: true // Chỉ lấy phương tiện đang hoạt động
  };
  
  if (vehicleType) filter.vehicleType = vehicleType;
  // Cho phép admin/manager xem cả phương tiện không active nếu cần
  if (isActive !== undefined && ['admin', 'manager'].includes(req.user.role)) {
    filter.isActive = isActive === 'true';
  }

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
