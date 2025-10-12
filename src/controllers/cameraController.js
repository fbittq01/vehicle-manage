import { Camera, User } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response.js';
import { createDepartmentFilter, checkResourceAccess } from '../utils/departmentFilter.js';
import { getCameraStatsByDepartment } from '../utils/departmentStats.js';

// Lấy danh sách camera
export const getCameras = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      gateId,
      position,
      isActive,
      isOnline,
      connectionStatus,
      managedBy,
      search
    } = req.query;

    // Xây dựng base filter
    const baseFilter = {};
    
    if (gateId) baseFilter['location.gateId'] = gateId;
    if (position) baseFilter['location.position'] = position;
    if (isActive !== undefined) baseFilter['status.isActive'] = isActive === 'true';
    if (isOnline !== undefined) baseFilter['status.isOnline'] = isOnline === 'true';
    if (connectionStatus) baseFilter['status.connectionStatus'] = connectionStatus;
    if (managedBy) baseFilter.managedBy = managedBy;
    
    // Search theo tên hoặc cameraId
    if (search) {
      baseFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { cameraId: { $regex: search, $options: 'i' } },
        { 'location.gateName': { $regex: search, $options: 'i' } }
      ];
    }

    // Tạo department filter
    const departmentFilter = await createDepartmentFilter(req.user, {
      ownerField: 'managedBy',
      allowSelfOnly: false
    });

    const filter = { ...baseFilter, ...departmentFilter };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const cameras = await Camera.find(filter)
      .populate('managedBy', 'name username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Camera.countDocuments(filter);

    return sendSuccessResponse(res, {
      cameras,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    }, 'Lấy danh sách camera thành công');

  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    console.error('Lỗi khi lấy danh sách camera:', error);
    return sendErrorResponse(res, 'Lỗi server khi lấy danh sách camera', 500);
  }
};

// Lấy thông tin chi tiết camera
export const getCameraById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const camera = await Camera.findById(id)
      .populate('managedBy', 'name username phone')
      .populate('maintenance.notes.createdBy', 'name username');

    if (!camera) {
      return sendErrorResponse(res, 'Không tìm thấy camera', 404);
    }

    // Kiểm tra quyền truy cập
    const hasAccess = await checkResourceAccess(req.user, camera, 'managedBy');
    if (!hasAccess) {
      return sendErrorResponse(res, 'Không có quyền xem camera này', 403);
    }

    return sendSuccessResponse(res, camera, 'Lấy thông tin camera thành công');

  } catch (error) {
    console.error('Lỗi khi lấy thông tin camera:', error);
    return sendErrorResponse(res, 'Lỗi server khi lấy thông tin camera', 500);
  }
};

// Tạo camera mới
export const createCamera = async (req, res) => {
  try {
    // Kiểm tra quyền
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return sendErrorResponse(res, 'Không có quyền tạo camera', 403);
    }

    const cameraData = req.body;
    
    // Kiểm tra camera ID đã tồn tại
    const existingCamera = await Camera.findOne({ cameraId: cameraData.cameraId });
    if (existingCamera) {
      return sendErrorResponse(res, 'ID camera đã tồn tại', 400);
    }

    // Nếu có IP address, kiểm tra trùng lặp
    if (cameraData.technical?.ipAddress) {
      const existingIP = await Camera.findOne({ 
        'technical.ipAddress': cameraData.technical.ipAddress,
        'technical.port': cameraData.technical?.port || 80
      });
      if (existingIP) {
        return sendErrorResponse(res, 'Địa chỉ IP và port đã được sử dụng', 400);
      }
    }

    const camera = new Camera({
      ...cameraData,
      managedBy: cameraData.managedBy || req.user._id
    });

    await camera.save();
    
    const populatedCamera = await Camera.findById(camera._id)
      .populate('managedBy', 'name username');

    return sendSuccessResponse(res, populatedCamera, 'Tạo camera thành công', 201);

  } catch (error) {
    console.error('Lỗi khi tạo camera:', error);
    
    if (error.code === 11000) {
      return sendErrorResponse(res, 'Thông tin camera đã tồn tại', 400);
    }
    
    return sendErrorResponse(res, 'Lỗi server khi tạo camera', 500);
  }
};

// Cập nhật thông tin camera
export const updateCamera = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Không tìm thấy camera', 404);
    }

    // Kiểm tra quyền
    if (req.user.role === 'user' && camera.managedBy.toString() !== req.user._id.toString()) {
      return sendErrorResponse(res, 'Không có quyền cập nhật camera này', 403);
    }

    // Kiểm tra camera ID mới nếu có thay đổi
    if (updateData.cameraId && updateData.cameraId !== camera.cameraId) {
      const existingCamera = await Camera.findOne({ 
        cameraId: updateData.cameraId,
        _id: { $ne: id }
      });
      if (existingCamera) {
        return sendErrorResponse(res, 'ID camera mới đã tồn tại', 400);
      }
    }

    // Kiểm tra IP address mới nếu có thay đổi
    if (updateData.technical?.ipAddress) {
      const existingIP = await Camera.findOne({ 
        'technical.ipAddress': updateData.technical.ipAddress,
        'technical.port': updateData.technical?.port || camera.technical?.port || 80,
        _id: { $ne: id }
      });
      if (existingIP) {
        return sendErrorResponse(res, 'Địa chỉ IP và port mới đã được sử dụng', 400);
      }
    }

    // Merge dữ liệu cập nhật
    Object.keys(updateData).forEach(key => {
      if (typeof updateData[key] === 'object' && updateData[key] !== null && !Array.isArray(updateData[key])) {
        camera[key] = { ...camera[key], ...updateData[key] };
      } else {
        camera[key] = updateData[key];
      }
    });

    await camera.save();
    
    const populatedCamera = await Camera.findById(camera._id)
      .populate('managedBy', 'name username');

    return sendSuccessResponse(res, populatedCamera, 'Cập nhật camera thành công');

  } catch (error) {
    console.error('Lỗi khi cập nhật camera:', error);
    return sendErrorResponse(res, 'Lỗi server khi cập nhật camera', 500);
  }
};

// Xóa camera
export const deleteCamera = async (req, res) => {
  try {
    const { id } = req.params;

    // Chỉ admin mới có thể xóa
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return sendErrorResponse(res, 'Không có quyền xóa camera', 403);
    }

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Không tìm thấy camera', 404);
    }

    // Soft delete - chỉ đánh dấu là không active
    camera.status.isActive = false;
    camera.status.isOnline = false;
    camera.status.connectionStatus = 'maintenance';
    await camera.save();

    return sendSuccessResponse(res, null, 'Xóa camera thành công');

  } catch (error) {
    console.error('Lỗi khi xóa camera:', error);
    return sendErrorResponse(res, 'Lỗi server khi xóa camera', 500);
  }
};

// Cập nhật trạng thái kết nối
export const updateCameraStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, errorInfo } = req.body;

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Không tìm thấy camera', 404);
    }

    await camera.updateStatus(status, errorInfo);

    return sendSuccessResponse(res, camera, 'Cập nhật trạng thái camera thành công');

  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái camera:', error);
    return sendErrorResponse(res, 'Lỗi server khi cập nhật trạng thái camera', 500);
  }
};

// Thêm ghi chú bảo trì
export const addMaintenanceNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return sendErrorResponse(res, 'Nội dung ghi chú là bắt buộc', 400);
    }

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Không tìm thấy camera', 404);
    }

    await camera.addMaintenanceNote(message, req.user._id);
    
    const updatedCamera = await Camera.findById(id)
      .populate('maintenance.notes.createdBy', 'name username');

    return sendSuccessResponse(res, updatedCamera, 'Thêm ghi chú bảo trì thành công');

  } catch (error) {
    console.error('Lỗi khi thêm ghi chú bảo trì:', error);
    return sendErrorResponse(res, 'Lỗi server khi thêm ghi chú bảo trì', 500);
  }
};

// Lập lịch bảo trì tiếp theo
export const scheduleNextMaintenance = async (req, res) => {
  try {
    const { id } = req.params;

    // Chỉ admin mới có thể lập lịch bảo trì
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return sendErrorResponse(res, 'Không có quyền lập lịch bảo trì', 403);
    }

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Không tìm thấy camera', 404);
    }

    await camera.scheduleNextMaintenance();

    return sendSuccessResponse(res, camera, 'Lập lịch bảo trì thành công');

  } catch (error) {
    console.error('Lỗi khi lập lịch bảo trì:', error);
    return sendErrorResponse(res, 'Lỗi server khi lập lịch bảo trì', 500);
  }
};

// Lấy camera theo cổng
export const getCamerasByGate = async (req, res) => {
  try {
    const { gateId } = req.params;
    
    const cameras = await Camera.findByGate(gateId);

    return sendSuccessResponse(res, cameras, 'Lấy danh sách camera theo cổng thành công');

  } catch (error) {
    console.error('Lỗi khi lấy camera theo cổng:', error);
    return sendErrorResponse(res, 'Lỗi server khi lấy camera theo cổng', 500);
  }
};

// Lấy camera cần bảo trì
export const getCamerasNeedingMaintenance = async (req, res) => {
  try {
    const cameras = await Camera.findNeedingMaintenance();

    return sendSuccessResponse(res, cameras, 'Lấy danh sách camera cần bảo trì thành công');

  } catch (error) {
    console.error('Lỗi khi lấy camera cần bảo trì:', error);
    return sendErrorResponse(res, 'Lỗi server khi lấy camera cần bảo trì', 500);
  }
};

// Lấy thống kê camera
export const getCameraStatistics = async (req, res) => {
  try {
    const statistics = await getCameraStatsByDepartment(req.user);
    return sendSuccessResponse(res, statistics, 'Lấy thống kê camera thành công');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    console.error('Lỗi khi lấy thống kê camera:', error);
    return sendErrorResponse(res, 'Lỗi server khi lấy thống kê camera', 500);
  }
};

// Cập nhật số lượng phát hiện
export const incrementDetection = async (req, res) => {
  try {
    const { id } = req.params;
    const { successful = true } = req.body;

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Không tìm thấy camera', 404);
    }

    await camera.incrementDetection(successful);

    return sendSuccessResponse(res, camera, 'Cập nhật thống kê phát hiện thành công');

  } catch (error) {
    console.error('Lỗi khi cập nhật thống kê phát hiện:', error);
    return sendErrorResponse(res, 'Lỗi server khi cập nhật thống kê phát hiện', 500);
  }
};
