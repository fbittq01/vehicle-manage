import mongoose from 'mongoose';
import { Camera, User } from './src/models/index.js';
import { initCameras, clearCameras } from './src/services/initCameraService.js';

// Kết nối database
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/quan-ly-phuong-tien', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Kết nối MongoDB thành công');
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error);
    process.exit(1);
  }
};

// Test các chức năng của Camera model
const testCameraModel = async () => {
  try {
    console.log('\n🧪 Bắt đầu test Camera Model...\n');

    // 1. Test tạo camera mới
    console.log('1️⃣ Test tạo camera mới...');
    const testCamera = new Camera({
      cameraId: 'TEST-CAM-001',
      name: 'Test Camera',
      description: 'Camera test chức năng',
      location: {
        gateId: 'TEST-GATE-01',
        gateName: 'Test Gate',
        position: 'entry'
      },
      technical: {
        ipAddress: '192.168.1.999',
        port: 80,
        protocol: 'http',
        resolution: {
          width: 1920,
          height: 1080
        },
        fps: 30
      }
    });

    await testCamera.save();
    console.log('✅ Tạo camera thành công:', testCamera.name);

    // 2. Test virtual fields
    console.log('\n2️⃣ Test virtual fields...');
    console.log('- Detection Success Rate:', testCamera.detectionSuccessRate + '%');
    console.log('- Warranty Valid:', testCamera.isWarrantyValid);
    console.log('- Needs Maintenance:', testCamera.needsMaintenance);

    // 3. Test instance methods
    console.log('\n3️⃣ Test instance methods...');
    
    // Test updateStatus
    await testCamera.updateStatus('connected');
    console.log('✅ Cập nhật trạng thái thành công:', testCamera.status.connectionStatus);

    // Test incrementDetection
    await testCamera.incrementDetection(true);
    console.log('✅ Cập nhật detection thành công:', testCamera.statistics.totalDetections);

    // Test addMaintenanceNote
    const adminUser = await User.findOne({ role: 'admin' }) || await User.findOne({ role: 'super_admin' });
    if (adminUser) {
      await testCamera.addMaintenanceNote('Test maintenance note', adminUser._id);
      console.log('✅ Thêm ghi chú bảo trì thành công');
    }

    // 4. Test static methods
    console.log('\n4️⃣ Test static methods...');
    
    // Test findActive
    const activeCameras = await Camera.findActive();
    console.log('✅ Tìm camera active:', activeCameras.length, 'cameras');

    // Test findOnline
    const onlineCameras = await Camera.findOnline();
    console.log('✅ Tìm camera online:', onlineCameras.length, 'cameras');

    // Test getStatistics
    const stats = await Camera.getStatistics();
    console.log('✅ Thống kê camera:', stats[0] || 'No data');

    // 5. Test validation
    console.log('\n5️⃣ Test validation...');
    try {
      const invalidCamera = new Camera({
        cameraId: 'INVALID',
        name: '', // Empty name should fail
        location: {
          gateId: 'TEST'
        }
      });
      await invalidCamera.save();
      console.log('❌ Validation test failed - should have thrown error');
    } catch (error) {
      console.log('✅ Validation working correctly:', error.message);
    }

    // 6. Cleanup test camera
    await Camera.findByIdAndDelete(testCamera._id);
    console.log('✅ Dọn dẹp test camera thành công');

    console.log('\n🎉 Tất cả test Camera Model đều thành công!\n');

  } catch (error) {
    console.error('❌ Lỗi khi test Camera Model:', error);
  }
};

// Test khởi tạo dữ liệu mẫu
const testInitCameras = async () => {
  try {
    console.log('🧪 Test khởi tạo dữ liệu camera...\n');

    // Xóa dữ liệu cũ
    await clearCameras();
    
    // Khởi tạo dữ liệu mới
    await initCameras();
    
    // Kiểm tra kết quả
    const totalCameras = await Camera.countDocuments();
    console.log(`📊 Tổng số camera sau khi khởi tạo: ${totalCameras}`);

    // Test các query
    const activeCount = await Camera.countDocuments({ 'status.isActive': true });
    const onlineCount = await Camera.countDocuments({ 'status.isOnline': true });
    
    console.log(`📈 Camera active: ${activeCount}`);
    console.log(`🌐 Camera online: ${onlineCount}`);

    console.log('\n✅ Test khởi tạo dữ liệu thành công!\n');

  } catch (error) {
    console.error('❌ Lỗi khi test khởi tạo camera:', error);
  }
};

// Main test function
const runTests = async () => {
  await connectDB();
  
  await testCameraModel();
  await testInitCameras();
  
  console.log('🏁 Hoàn thành tất cả các test!\n');
  process.exit(0);
};

// Chạy tests
runTests().catch(error => {
  console.error('❌ Lỗi khi chạy tests:', error);
  process.exit(1);
});
