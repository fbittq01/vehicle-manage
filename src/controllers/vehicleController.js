import { Vehicle, User } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { normalizeLicensePlate, validateVietnameseLicensePlate } from '../utils/licensePlate.js';
import { asyncHandler } from '../middleware/logger.js';

// Lấy danh sách vehicles
export const getVehicles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { vehicleType, isActive, search, owner } = req.query;

  // Build query filter
  const filter = {};
  
  if (vehicleType) filter.vehicleType = vehicleType;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (owner) filter.owner = owner;
  
  if (search) {
    const normalizedSearch = normalizeLicensePlate(search);
    filter.$or = [
      { licensePlate: { $regex: normalizedSearch, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
      { model: { $regex: search, $options: 'i' } },
      { color: { $regex: search, $options: 'i' } }
    ];
  }

  // Nếu là user thường, chỉ xem được xe của mình
  if (req.user.role === 'user') {
    filter.owner = req.user._id;
  }

  // Execute query
  const [vehicles, total] = await Promise.all([
    Vehicle.find(filter)
      .populate('owner', 'name email phone department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Vehicle.countDocuments(filter)
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, vehicles, pagination, 'Lấy danh sách vehicles thành công');
});

// Lấy thông tin vehicle theo ID
export const getVehicleById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id).populate('owner', 'name email phone department');
  
  if (!vehicle) {
    return sendErrorResponse(res, 'Không tìm thấy vehicle', 404);
  }

  // Kiểm tra quyền truy cập
  if (req.user.role === 'user' && vehicle.owner._id.toString() !== req.user._id.toString()) {
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
  }).populate('owner', 'name email phone department');

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
  const { licensePlate, owner, vehicleType, brand, model, color, year, description, expiryDate, insurance } = req.body;

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
    brand,
    model,
    color,
    year,
    description,
    expiryDate,
    insurance
  });

  await vehicle.save();
  
  const populatedVehicle = await Vehicle.findById(vehicle._id)
    .populate('owner', 'name email phone department');

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
  ).populate('owner', 'name email phone department');

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
    .populate('owner', 'name email phone department');

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

// Thêm lịch sử bảo trì
export const addMaintenanceRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, description, cost, serviceProvider, date } = req.body;

  const vehicle = await Vehicle.findById(id);
  if (!vehicle) {
    return sendErrorResponse(res, 'Không tìm thấy vehicle', 404);
  }

  // Kiểm tra quyền
  if (req.user.role === 'user' && vehicle.owner.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, 'Không có quyền thêm lịch sử bảo trì cho vehicle này', 403);
  }

  await vehicle.addMaintenanceRecord({
    type,
    description,
    cost,
    serviceProvider,
    date: date || new Date()
  });

  const updatedVehicle = await Vehicle.findById(id)
    .populate('owner', 'name email phone department');

  sendSuccessResponse(res, { vehicle: updatedVehicle }, 'Thêm lịch sử bảo trì thành công');
});

// Lấy vehicles sắp hết hạn bảo hiểm
export const getInsuranceExpiring = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const vehicles = await Vehicle.findInsuranceExpiring(parseInt(days));

  sendSuccessResponse(res, { vehicles, count: vehicles.length }, 
    `Danh sách vehicles sắp hết hạn bảo hiểm trong ${days} ngày`);
});

// Thống kê vehicles
export const getVehicleStats = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'user' ? { owner: req.user._id } : {};

  const stats = await Vehicle.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalVehicles: { $sum: 1 },
        activeVehicles: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactiveVehicles: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        },
        vehiclesByType: {
          $push: {
            type: '$vehicleType',
            isActive: '$isActive'
          }
        },
        insuranceExpiring: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$insurance.expiryDate', null] },
                  { $lte: ['$insurance.expiryDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] },
                  { $gte: ['$insurance.expiryDate', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  sendSuccessResponse(res, stats[0] || {}, 'Lấy thống kê vehicles thành công');
});
