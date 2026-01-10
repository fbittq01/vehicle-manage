import { User } from '../models/index.js';
import { initCameras } from './initCameraService.js';

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

// Service để quản lý database initialization
export const initializeDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Tạo super admin
    await createSuperAdmin();
    
    // Khởi tạo dữ liệu camera mẫu
    // await initCameras();
    
    // Có thể thêm các initialization khác ở đây
    // Ví dụ: tạo default gates, vehicle types, etc.
    
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};
