import { Camera } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response.js';
import { createDepartmentFilter, checkResourceAccess } from '../utils/departmentFilter.js';
import { getCameraStatsByDepartment } from '../utils/departmentStats.js';
import socketService from '../socket/socketService.js';

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
    // Thêm thông tin mật khẩu đã hash cho từng camera
    const camerasWithPassword = cameras.map(camera => {
      const cameraObj = camera.toObject();
      return cameraObj;
    });

    const total = await Camera.countDocuments(filter);

    return sendSuccessResponse(res, {
      cameras: camerasWithPassword,
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

    return sendSuccessResponse(res, camera.toObject(), 'Lấy thông tin camera thành công');

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

    // Thêm thông tin mật khẩu đã hash
    const cameraObj = populatedCamera.toObject();

    return sendSuccessResponse(res, cameraObj, 'Tạo camera thành công', 201);

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

    // Thêm thông tin mật khẩu đã mã hóa
    const cameraObj = populatedCamera.toObject();

    return sendSuccessResponse(res, cameraObj, 'Cập nhật camera thành công');

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

// ============= RECOGNITION FUNCTIONS =============

// Lấy danh sách camera cho phép nhận diện
export const getRecognitionEnabledCameras = async (req, res) => {
  try {
    // Tạo department filter
    const departmentFilter = await createDepartmentFilter(req.user, {
      ownerField: 'managedBy',
      allowSelfOnly: false
    });

    const filter = {
      'status.isActive': true,
      'recognition.enabled': true,
      ...departmentFilter
    };

    const cameras = await Camera.find(filter)
      .populate('managedBy', 'name username')
      .select('cameraId name description location technical streaming status recognition managedBy')
      .lean();

    // Format dữ liệu trả về
    const recognitionCameras = cameras.map(camera => {
      // Chuyển đổi ROI từ {x, y, width, height} sang [x1, y1, x2, y2]
      let roiArray = null;
      if (camera.recognition?.roi) {
        const roi = camera.recognition.roi;
        if (roi.x !== undefined && roi.y !== undefined && roi.width !== undefined && roi.height !== undefined) {
          roiArray = [
            roi.x,              // x1
            roi.y,              // y1
            roi.x + roi.width,  // x2
            roi.y + roi.height  // y2
          ];
        }
      }

      return {
        _id: camera._id,
        cameraId: camera.cameraId,
        name: camera.name,
        description: camera.description,
        location: camera.location,
        technical: {
          ipAddress: camera.technical?.ipAddress,
          port: camera.technical?.port,
          protocol: camera.technical?.protocol,
          streamUrl: camera.technical?.streamUrl,
          resolution: camera.technical?.resolution,
          fps: camera.technical?.fps
        },
        streaming: camera.streaming,
        status: camera.status,
        recognition: {
          ...camera.recognition,
          roi: roiArray
        },
        managedBy: camera.managedBy
      };
    });

    return sendSuccessResponse(res, recognitionCameras, 'Danh sách camera cho phép nhận diện');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    console.error('Error getting recognition enabled cameras:', error);
    return sendErrorResponse(res, 'Lỗi server khi lấy danh sách cameras', 500);
  }
};

// ============= VIDEO STREAMING FUNCTIONS =============

// Lấy danh sách cameras có thể stream
export const getStreamableCameras = async (req, res) => {
  try {
    const { quality } = req.query;
    
    // Tạo department filter
    const departmentFilter = await createDepartmentFilter(req.user, {
      ownerField: 'managedBy',
      allowSelfOnly: false
    });

    const filter = {
      'status.isActive': true,
      'streaming.enabled': true,
      ...departmentFilter
    };

    const cameras = await Camera.find(filter)
      .populate('managedBy', 'name username')
      .lean();

    // Chỉ trả về các fields cần thiết và đảm bảo password được bao gồm
    const streamableCameras = cameras.map(camera => ({
      _id: camera._id,
      cameraId: camera.cameraId,
      name: camera.name,
      description: camera.description,
      location: camera.location,
      technical: camera.technical,
      streaming: camera.streaming,
      status: camera.status,
      managedBy: camera.managedBy
    }));

    return sendSuccessResponse(res, streamableCameras, 'Danh sách cameras streaming');
  } catch (error) {
    console.error('Error getting streamable cameras:', error);
    return sendErrorResponse(res, 'Lỗi server khi lấy danh sách cameras', 500);
  }
};

// Bắt đầu stream từ camera
export const startCameraStream = async (req, res) => {
  try {
    const { id } = req.params;
    const { quality = 'medium' } = req.body;

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Camera không tồn tại', 404);
    }

    // Kiểm tra quyền truy cập
    const hasAccess = await checkResourceAccess(req.user, camera, 'managedBy');
    if (!hasAccess) {
      return sendErrorResponse(res, 'Không có quyền truy cập camera này', 403);
    }

    if (!camera.status.isActive || !camera.streaming.enabled) {
      return sendErrorResponse(res, 'Camera không thể stream', 400);
    }

    if (camera.streaming.isStreaming) {
      return sendErrorResponse(res, 'Camera đã đang stream', 400);
    }

    // Gửi command tới Python server
    const success = socketService.sendToPythonServer({
      type: 'start_stream',
      data: {
        cameraId: camera._id.toString(),
        streamUrl: camera.technical.streamUrl,
        quality,
        requestedBy: req.user._id.toString()
      }
    });

    if (!success) {
      return sendErrorResponse(res, 'Python server không khả dụng', 503);
    }

    // Cập nhật trạng thái camera
    camera.streaming.isStreaming = true;
    camera.streaming.lastStreamStarted = new Date();
    camera.streaming.quality = quality;
    await camera.save();

    return sendSuccessResponse(res, {
      cameraId: camera._id,
      streamStarted: true,
      quality
    }, 'Stream đã được bắt đầu');

  } catch (error) {
    console.error('Error starting camera stream:', error);
    return sendErrorResponse(res, 'Lỗi server khi bắt đầu stream', 500);
  }
};

// Dừng stream từ camera
export const stopCameraStream = async (req, res) => {
  try {
    const { id } = req.params;

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Camera không tồn tại', 404);
    }

    // Kiểm tra quyền truy cập
    const hasAccess = await checkResourceAccess(req.user, camera, 'managedBy');
    if (!hasAccess) {
      return sendErrorResponse(res, 'Không có quyền truy cập camera này', 403);
    }

    // Gửi command tới Python server
    socketService.sendToPythonServer({
      type: 'stop_stream',
      data: {
        cameraId: camera._id.toString(),
        requestedBy: req.user._id.toString()
      }
    });

    // Cập nhật trạng thái camera
    camera.streaming.isStreaming = false;
    camera.streaming.lastStreamStopped = new Date();
    await camera.save();

    return sendSuccessResponse(res, {
      cameraId: camera._id,
      streamStopped: true
    }, 'Stream đã được dừng');

  } catch (error) {
    console.error('Error stopping camera stream:', error);
    return sendErrorResponse(res, 'Lỗi server khi dừng stream', 500);
  }
};



// Lấy trạng thái stream của camera
export const getStreamStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Camera không tồn tại', 404);
    }

    // Kiểm tra quyền truy cập
    const hasAccess = await checkResourceAccess(req.user, camera, 'managedBy');
    if (!hasAccess) {
      return sendErrorResponse(res, 'Không có quyền truy cập camera này', 403);
    }

    const status = {
      cameraId: camera._id,
      name: camera.name,
      isActive: camera.status.isActive,
      streamEnabled: camera.streaming.enabled,
      isStreaming: camera.streaming.isStreaming,
      lastStreamStarted: camera.streaming.lastStreamStarted,
      lastStreamStopped: camera.streaming.lastStreamStopped,
      quality: camera.streaming.quality || 'medium',
      currentViewers: camera.streaming.currentViewers || 0
    };

    return sendSuccessResponse(res, status, 'Trạng thái stream camera');

  } catch (error) {
    console.error('Error getting stream status:', error);
    return sendErrorResponse(res, 'Lỗi server khi lấy trạng thái stream', 500);
  }
};

// Lấy danh sách tất cả streams đang hoạt động
export const getActiveStreams = async (req, res) => {
  try {
    // Tạo department filter
    const departmentFilter = await createDepartmentFilter(req.user, {
      ownerField: 'managedBy',
      allowSelfOnly: false
    });

    const filter = {
      'status.isActive': true,
      'streaming.isStreaming': true,
      ...departmentFilter
    };

    const activeStreams = await Camera.find(filter)
      .populate('managedBy', 'name username')
      .select('name description location streaming.quality streaming.lastStreamStarted streaming.currentViewers');

    return sendSuccessResponse(res, activeStreams, 'Danh sách streams đang hoạt động');

  } catch (error) {
    console.error('Error getting active streams:', error);
    return sendErrorResponse(res, 'Lỗi server khi lấy danh sách streams', 500);
  }
};

// Cập nhật cài đặt stream cho camera
export const updateStreamSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { quality, streamEnabled, frameRate, resolution, bitrate, maxClients } = req.body;

    const camera = await Camera.findById(id);
    if (!camera) {
      return sendErrorResponse(res, 'Camera không tồn tại', 404);
    }

    // Kiểm tra quyền truy cập (chỉ admin hoặc người quản lý camera)
    const hasAccess = await checkResourceAccess(req.user, camera, 'managedBy');
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    
    if (!hasAccess && !isAdmin) {
      return sendErrorResponse(res, 'Không có quyền cập nhật cài đặt camera này', 403);
    }

    // Cập nhật cài đặt streaming
    if (quality !== undefined) camera.streaming.quality = quality;
    if (streamEnabled !== undefined) camera.streaming.enabled = streamEnabled;
    if (frameRate !== undefined) camera.streaming.frameRate = frameRate;
    if (bitrate !== undefined) camera.streaming.bitrate = bitrate;
    if (maxClients !== undefined) camera.streaming.maxClients = maxClients;
    
    // Cập nhật resolution trong technical specs
    if (resolution !== undefined) {
      if (!camera.technical.resolution) camera.technical.resolution = {};
      if (resolution.width) camera.technical.resolution.width = resolution.width;
      if (resolution.height) camera.technical.resolution.height = resolution.height;
    }

    await camera.save();

    // Nếu camera đang stream và có thay đổi cài đặt, gửi update tới Python server
    if (camera.streaming.isStreaming) {
      socketService.sendToPythonServer({
        type: 'update_stream_settings',
        data: {
          cameraId: camera._id.toString(),
          quality: camera.streaming.quality,
          frameRate: camera.streaming.frameRate,
          resolution: camera.technical.resolution,
          bitrate: camera.streaming.bitrate
        }
      });
    }

    return sendSuccessResponse(res, {
      cameraId: camera._id,
      settings: {
        quality: camera.streaming.quality,
        streamEnabled: camera.streaming.enabled,
        frameRate: camera.streaming.frameRate,
        resolution: camera.technical.resolution,
        bitrate: camera.streaming.bitrate,
        maxClients: camera.streaming.maxClients
      }
    }, 'Cài đặt stream đã được cập nhật');

  } catch (error) {
    console.error('Error updating stream settings:', error);
    return sendErrorResponse(res, 'Lỗi server khi cập nhật cài đặt', 500);
  }
};
