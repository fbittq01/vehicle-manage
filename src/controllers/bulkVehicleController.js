import XLSX from 'xlsx';
import { Vehicle, User, Department } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/logger.js';
import { normalizeLicensePlate, validateVietnameseLicensePlate } from '../utils/licensePlate.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Tạo file Excel mẫu cho bulk upload vehicles
export const getVehicleTemplate = asyncHandler(async (req, res) => {
  try {
    // Tạo dữ liệu mẫu
    const sampleData = [
      {
        'Biển số xe': '29A-123.45',
        'Loại xe (car/motorcycle/truck/bus/bicycle/other)': 'car',
        'Tên xe': 'Honda Civic',
        'Màu sắc': 'Trắng',
        'Mô tả': 'Xe sedan 4 chỗ ngồi',
        'Họ và tên chủ xe': 'Nguyễn Văn An',
        'Số điện thoại': '0123456789',
        'Mã nhân viên': 'NV001',
        'Ngày hết hạn đăng ký (dd/mm/yyyy)': '31/12/2025'
      },
      {
        'Biển số xe': '30B-456.78',
        'Loại xe (car/motorcycle/truck/bus/bicycle/other)': 'motorcycle',
        'Tên xe': 'Honda Wave',
        'Màu sắc': 'Đỏ',
        'Mô tả': 'Xe máy số',
        'Họ và tên chủ xe': 'Trần Thị Bình',
        'Số điện thoại': '0987654321',
        'Mã nhân viên': 'NV002',
        'Ngày hết hạn đăng ký (dd/mm/yyyy)': '15/06/2026'
      }
    ];

    // Tạo workbook
    const wb = XLSX.utils.book_new();
    
    // Tạo worksheet từ dữ liệu mẫu
    const ws = XLSX.utils.json_to_sheet(sampleData);
    
    // Thiết lập width cho các cột
    const colWidths = [
      { wch: 15 }, // Biển số xe
      { wch: 40 }, // Loại xe
      { wch: 20 }, // Tên xe
      { wch: 15 }, // Màu sắc
      { wch: 30 }, // Mô tả
      { wch: 20 }, // Họ và tên
      { wch: 15 }, // Số điện thoại
      { wch: 15 }, // Mã nhân viên
      { wch: 25 }  // Ngày hết hạn
    ];
    ws['!cols'] = colWidths;
    
    // Thêm worksheet vào workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Vehicles');
    
    // Tạo buffer từ workbook
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers và gửi file
    res.setHeader('Content-Disposition', 'attachment; filename=vehicle_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating vehicle template:', error);
    sendErrorResponse(res, 'Lỗi khi tạo file mẫu', 500);
  }
});

// Bulk upload vehicles từ Excel file
export const bulkUploadVehicles = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return sendErrorResponse(res, 'Chỉ admin mới có thể thực hiện bulk upload', 403);
    }

    // Kiểm tra có file không
    if (!req.file) {
      return sendErrorResponse(res, 'Vui lòng tải lên file Excel', 400);
    }

    // Đọc file Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return sendErrorResponse(res, 'File Excel không có dữ liệu', 400);
    }

    // Lấy thông tin department của admin
    const adminDepartment = req.user.department;
    if (!adminDepartment) {
      return sendErrorResponse(res, 'Admin phải thuộc một phòng ban để thực hiện bulk upload', 400);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      createdUsers: [],
      createdVehicles: []
    };

    await session.withTransaction(async () => {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowIndex = i + 2; // +2 vì Excel bắt đầu từ dòng 1 và có header
        
        try {
          // Validate dữ liệu bắt buộc
          const licensePlate = row['Biển số xe'];
          const vehicleType = row['Loại xe (car/motorcycle/truck/bus/bicycle/other)'];
          const ownerName = row['Họ và tên chủ xe'];
          const phone = row['Số điện thoại'];
          const employeeId = row['Mã nhân viên'];

          if (!licensePlate || !vehicleType || !ownerName || !employeeId) {
            throw new Error(`Dòng ${rowIndex}: Thiếu thông tin bắt buộc (Biển số xe, Loại xe, Họ và tên chủ xe, Mã nhân viên)`);
          }

          // Normalize và validate biển số
          const normalizedLicensePlate = normalizeLicensePlate(licensePlate);
          if (!validateVietnameseLicensePlate(normalizedLicensePlate)) {
            throw new Error(`Dòng ${rowIndex}: Biển số xe không hợp lệ`);
          }

          // Validate loại xe
          const validVehicleTypes = ['car', 'motorcycle', 'truck', 'bus', 'bicycle', 'other'];
          if (!validVehicleTypes.includes(vehicleType)) {
            throw new Error(`Dòng ${rowIndex}: Loại xe không hợp lệ. Phải là một trong: ${validVehicleTypes.join(', ')}`);
          }

          // Kiểm tra biển số đã tồn tại
          const existingVehicle = await Vehicle.findOne({ 
            licensePlate: normalizedLicensePlate 
          }).session(session);
          
          if (existingVehicle) {
            throw new Error(`Dòng ${rowIndex}: Biển số xe ${normalizedLicensePlate} đã tồn tại`);
          }

          // Tạo username từ tên và mã nhân viên
          const username = createUsername(ownerName, employeeId);
          
          // Tìm hoặc tạo user
          let owner = await User.findOne({ 
            $or: [
              { username: username },
              { employeeId: employeeId }
            ]
          }).session(session);

          if (!owner) {
            // Tạo user mới
            const defaultPassword = 'Admin@123';
            
            owner = new User({
              username: username,
              password: defaultPassword,
              name: ownerName,
              phone: phone || '',
              employeeId: employeeId,
              department: adminDepartment,
              role: 'user'
            });

            await owner.save({ session });
            results.createdUsers.push({
              username: username,
              name: ownerName,
              employeeId: employeeId,
              defaultPassword: defaultPassword
            });
          } else {
            // Kiểm tra user có thuộc cùng department không
            if (owner.department.toString() !== adminDepartment.toString()) {
              throw new Error(`Dòng ${rowIndex}: Nhân viên ${ownerName} không thuộc phòng ban của bạn`);
            }
          }

          // Tạo vehicle mới
          const vehicle = new Vehicle({
            licensePlate: normalizedLicensePlate,
            owner: owner._id,
            vehicleType: vehicleType,
            name: row['Tên xe'] || '',
            color: row['Màu sắc'] || '',
            description: row['Mô tả'] || ''
          });

          await vehicle.save({ session });
          results.createdVehicles.push({
            licensePlate: normalizedLicensePlate,
            owner: ownerName,
            vehicleType: vehicleType
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: rowIndex,
            error: error.message
          });
        }
      }
    });

    await session.endSession();

    // Trả về kết quả
    const responseData = {
      summary: {
        total: data.length,
        success: results.success,
        failed: results.failed
      },
      createdUsers: results.createdUsers,
      createdVehicles: results.createdVehicles,
      errors: results.errors
    };

    if (results.failed > 0) {
      return res.status(207).json({
        success: true,
        message: `Hoàn thành bulk upload với ${results.success} thành công, ${results.failed} thất bại`,
        data: responseData
      });
    }

    sendSuccessResponse(res, responseData, 'Bulk upload vehicles thành công');

  } catch (error) {
    await session.endSession();
    console.error('Bulk upload error:', error);
    sendErrorResponse(res, 'Lỗi khi thực hiện bulk upload: ' + error.message, 500);
  }
});

// Helper function tạo username từ tên và mã nhân viên
function createUsername(fullName, employeeId) {
  // Chuyển về lowercase và loại bỏ dấu
  const nameWithoutAccent = removeVietnameseAccent(fullName.toLowerCase());
  
  // Tách từ và lấy họ + tên
  const words = nameWithoutAccent.split(' ').filter(word => word.length > 0);
  let processedName = '';
  
  if (words.length >= 2) {
    // Lấy họ (từ đầu) + tên (từ cuối)
    processedName = words[0] + '_' + words[words.length - 1];
  } else if (words.length === 1) {
    processedName = words[0];
  }
  
  // Kết hợp với mã nhân viên
  return `${processedName}_${employeeId}`.replace(/[^a-zA-Z0-9_]/g, '');
}

// Helper function loại bỏ dấu tiếng Việt
function removeVietnameseAccent(str) {
  const accents = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a', 'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e', 'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o', 'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u', 'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y'
  };
  
  return str.split('').map(char => accents[char] || char).join('');
}
