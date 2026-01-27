import { User, Camera } from '../models/index.js';
import { initCameras } from './initCameraService.js';
import mediamtxService from './mediamtxService.js';

// Tạo super admin account khi khởi động ứng dụng
export const createSuperAdmin = async () => {
  try {
    const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

    // Kiểm tra xem đã có super admin chưa
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    
    if (existingSuperAdmin) {
      console.log('Super admin already exists');
      return existingSuperAdmin;
    }

    // Tạo super admin mới
    const superAdmin = new User({
      username: superAdminUsername,
      password: superAdminPassword,
      name: 'Super Administrator',
      role: 'super_admin',
      isActive: true
    });

    await superAdmin.save();
    console.log(`Super admin created successfully with username: ${superAdminUsername}`);
    
    return superAdmin;
  } catch (error) {
    console.error('Error creating super admin:', error);
    throw error;
  }
};

// Đồng bộ tất cả camera paths vào MediaMTX khi server khởi động
export const syncMediaMTXPaths = async () => {
  try {
    console.log('🔄 Syncing camera paths to MediaMTX...');
    
    // Kiểm tra MediaMTX service có enabled không
    if (!mediamtxService.isEnabled()) {
      console.log('⏭️ MediaMTX service is disabled, skipping sync');
      return;
    }

    // Kiểm tra MediaMTX server có khả dụng không
    const healthCheck = await mediamtxService.checkHealth();
    if (!healthCheck.available) {
      console.warn(`⚠️ MediaMTX server is not available: ${healthCheck.message}`);
      console.warn('⚠️ Skipping MediaMTX sync - paths will not be available until MediaMTX is running');
      return;
    }

    // Lấy tất cả active cameras có streamUrl
    const cameras = await Camera.find({
      'status.isActive': true,
      'technical.streamUrl': { $exists: true, $ne: null }
    });

    if (cameras.length === 0) {
      console.log('ℹ️ No active cameras with stream URLs found, skipping sync');
      return;
    }

    // Đồng bộ paths
    const result = await mediamtxService.syncAllPaths(cameras);
    
    console.log(`✅ MediaMTX sync completed: ${result.success}/${result.total} paths synced`);
    
    if (result.failed > 0) {
      console.warn(`⚠️ ${result.failed} paths failed to sync`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error syncing MediaMTX paths:', error);
    // Không throw error - không muốn block server startup nếu MediaMTX không khả dụng
  }
};

// Service để quản lý database initialization
export const initializeDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Tạo super admin
    await createSuperAdmin();
    
    // Khởi tạo dữ liệu camera mẫu
    // await initCameras();
    
    // Đồng bộ camera paths vào MediaMTX
    await syncMediaMTXPaths();
    
    // Có thể thêm các initialization khác ở đây
    // Ví dụ: tạo default gates, vehicle types, etc.
    
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};
