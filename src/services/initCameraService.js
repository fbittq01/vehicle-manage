import { Camera, User } from '../models/index.js';

// Dữ liệu camera mẫu
const sampleCameras = [
  {
    cameraId: 'CAM-GATE-01',
    name: 'Camera Cổng Chính - Vào',
    description: 'Camera giám sát phương tiện vào cổng chính',
    location: {
      gateId: 'GATE-01',
      gateName: 'Cổng chính',
      position: 'entry',
      coordinates: {
        latitude: 10.762622,
        longitude: 106.660172
      }
    },
    technical: {
      ipAddress: '192.168.1.101',
      port: 80,
      protocol: 'http',
      username: 'admin',
      password: 'admin123',
      streamUrl: 'rtsp://192.168.1.101:554/stream1',
      resolution: {
        width: 1920,
        height: 1080
      },
      fps: 30
    },
    recognition: {
      enabled: true,
      confidence: {
        threshold: 0.7,
        autoApprove: 0.9
      },
      roi: {
        x: 100,
        y: 200,
        width: 800,
        height: 400
      },
      processingInterval: 1000
    },
    status: {
      isActive: true,
      isOnline: true,
      connectionStatus: 'connected'
    },
    manufacturer: 'Hikvision',
    model: 'DS-2CD2142FWD-I',
    serialNumber: 'HK-001-2023'
  },
  {
    cameraId: 'CAM-GATE-02',
    name: 'Camera Cổng Chính - Ra',
    description: 'Camera giám sát phương tiện ra cổng chính',
    location: {
      gateId: 'GATE-01',
      gateName: 'Cổng chính',
      position: 'exit',
      coordinates: {
        latitude: 10.762625,
        longitude: 106.660175
      }
    },
    technical: {
      ipAddress: '192.168.1.102',
      port: 80,
      protocol: 'http',
      username: 'admin',
      password: 'admin123',
      streamUrl: 'rtsp://192.168.1.102:554/stream1',
      resolution: {
        width: 1920,
        height: 1080
      },
      fps: 30
    },
    recognition: {
      enabled: true,
      confidence: {
        threshold: 0.7,
        autoApprove: 0.9
      },
      roi: {
        x: 100,
        y: 200,
        width: 800,
        height: 400
      },
      processingInterval: 1000
    },
    status: {
      isActive: true,
      isOnline: true,
      connectionStatus: 'connected'
    },
    manufacturer: 'Hikvision',
    model: 'DS-2CD2142FWD-I',
    serialNumber: 'HK-002-2023'
  },
  {
    cameraId: 'CAM-GATE-03',
    name: 'Camera Cổng Phụ',
    description: 'Camera giám sát cổng phụ (2 chiều)',
    location: {
      gateId: 'GATE-02',
      gateName: 'Cổng phụ',
      position: 'both',
      coordinates: {
        latitude: 10.762630,
        longitude: 106.660180
      }
    },
    technical: {
      ipAddress: '192.168.1.103',
      port: 80,
      protocol: 'http',
      username: 'admin',
      password: 'admin123',
      streamUrl: 'rtsp://192.168.1.103:554/stream1',
      resolution: {
        width: 1280,
        height: 720
      },
      fps: 25
    },
    recognition: {
      enabled: true,
      confidence: {
        threshold: 0.6,
        autoApprove: 0.85
      },
      roi: {
        x: 50,
        y: 100,
        width: 600,
        height: 300
      },
      processingInterval: 1500
    },
    status: {
      isActive: true,
      isOnline: false,
      connectionStatus: 'disconnected'
    },
    manufacturer: 'Dahua',
    model: 'IPC-HFW4431S-P',
    serialNumber: 'DH-001-2023'
  },
  {
    cameraId: 'CAM-BACKUP-01',
    name: 'Camera Dự Phòng',
    description: 'Camera dự phòng cho khu vực bãi xe',
    location: {
      gateId: 'GATE-03',
      gateName: 'Khu vực bãi xe',
      position: 'both',
      coordinates: {
        latitude: 10.762640,
        longitude: 106.660190
      }
    },
    technical: {
      ipAddress: '192.168.1.104',
      port: 8080,
      protocol: 'http',
      username: 'admin',
      password: 'admin123',
      streamUrl: 'rtsp://192.168.1.104:554/stream1',
      resolution: {
        width: 1280,
        height: 720
      },
      fps: 20
    },
    recognition: {
      enabled: false,
      confidence: {
        threshold: 0.5,
        autoApprove: 0.8
      },
      processingInterval: 2000
    },
    status: {
      isActive: true,
      isOnline: true,
      connectionStatus: 'connected'
    },
    manufacturer: 'Axis',
    model: 'M3027-PVE',
    serialNumber: 'AX-001-2023'
  }
];

// Hàm khởi tạo dữ liệu camera
export const initCameras = async () => {
  try {
    // Kiểm tra xem đã có camera nào chưa
    const existingCamerasCount = await Camera.countDocuments();
    if (existingCamerasCount > 0) {
      console.log('❌ Dữ liệu camera đã tồn tại, bỏ qua khởi tạo');
      return;
    }

    // Tìm admin user để gán làm người quản lý
    const adminUser = await User.findOne({ role: 'admin' }) || await User.findOne({ role: 'super_admin' });
    if (!adminUser) {
      console.log('⚠️ Không tìm thấy admin user, tạo camera không có người quản lý');
    }

    // Tạo camera với thông tin người quản lý
    const camerasToCreate = sampleCameras.map(camera => ({
      ...camera,
      managedBy: adminUser?._id,
      installationDate: new Date(),
      warrantyExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 năm
      maintenance: {
        maintenanceInterval: 30,
        nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
        notes: []
      },
      statistics: {
        totalDetections: Math.floor(Math.random() * 1000),
        successfulDetections: Math.floor(Math.random() * 800),
        uptime: Math.floor(Math.random() * 8760) // Random uptime trong năm
      }
    }));

    await Camera.insertMany(camerasToCreate);
    console.log('✅ Khởi tạo dữ liệu camera thành công');
    console.log(`📹 Đã tạo ${camerasToCreate.length} camera mẫu`);

    // In thông tin camera đã tạo
    const createdCameras = await Camera.find().populate('managedBy', 'name username');
    console.log('\n📋 Danh sách camera đã tạo:');
    createdCameras.forEach((camera, index) => {
      console.log(`${index + 1}. ${camera.name} (${camera.cameraId})`);
      console.log(`   📍 Vị trí: ${camera.location.gateName} - ${camera.location.position}`);
      console.log(`   🌐 IP: ${camera.technical.ipAddress}:${camera.technical.port}`);
      console.log(`   📊 Trạng thái: ${camera.status.connectionStatus} (${camera.status.isOnline ? 'Online' : 'Offline'})`);
      console.log(`   👤 Quản lý: ${camera.managedBy ? camera.managedBy.name : 'Chưa có'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Lỗi khi khởi tạo dữ liệu camera:', error);
    throw error;
  }
};

// Hàm xóa tất cả camera (để test)
export const clearCameras = async () => {
  try {
    const deleteResult = await Camera.deleteMany({});
    console.log(`🗑️ Đã xóa ${deleteResult.deletedCount} camera`);
  } catch (error) {
    console.error('❌ Lỗi khi xóa camera:', error);
    throw error;
  }
};

// Hàm cập nhật trạng thái camera ngẫu nhiên (để demo)
export const updateRandomCameraStatus = async () => {
  try {
    const cameras = await Camera.find({ 'status.isActive': true });
    if (cameras.length === 0) {
      console.log('❌ Không có camera nào để cập nhật');
      return;
    }

    const randomCamera = cameras[Math.floor(Math.random() * cameras.length)];
    const statuses = ['connected', 'disconnected', 'error'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    await randomCamera.updateStatus(randomStatus, 
      randomStatus === 'error' ? { 
        message: 'Lỗi kết nối network', 
        code: 'NETWORK_ERROR' 
      } : null
    );

    console.log(`🔄 Đã cập nhật trạng thái camera ${randomCamera.name}: ${randomStatus}`);
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật trạng thái camera:', error);
  }
};
