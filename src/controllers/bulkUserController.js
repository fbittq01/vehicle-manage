import XLSX from 'xlsx';
import { User, Department } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/logger.js';
import bcrypt from 'bcryptjs';

// Helper function loại bỏ dấu tiếng Việt (reuse code)
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

// Helper function tạo username từ tên và mã nhân viên
function createUsername(fullName, employeeId) {
  // Chuyển về lowercase và loại bỏ dấu
  const nameWithoutAccent = removeVietnameseAccent(fullName.toLowerCase());
  
  // Loại bỏ khoảng trắng
  const nameClean = nameWithoutAccent.replace(/\s+/g, '');
  
  // Kết hợp với mã nhân viên (dạng lowercase)
  // Ví dụ: Nguyễn Thi Bình, NV001 -> nguyenthibinhnv001
  return `${nameClean}${employeeId.toLowerCase()}`;
}

// Tạo file Excel mẫu cho bulk upload users
export const getUserTemplate = asyncHandler(async (req, res) => {
  try {
    // Tạo dữ liệu mẫu
    const sampleData = [
      {
        'Họ và tên': 'Nguyễn Văn A',
        'Số điện thoại': '0912345678',
        'Mã nhân viên': 'NV001',
        'Mã phòng ban': 'IT',
        'Role (user, admin)': 'user'
      },
      {
        'Họ và tên': 'Trần Thị B',
        'Số điện thoại': '0987654321',
        'Mã nhân viên': 'NV002',
        'Mã phòng ban': 'HR',
        'Role (user, admin)': 'supervisor'
      }
    ];

    // Tạo workbook
    const wb = XLSX.utils.book_new();
    
    // Tạo worksheet từ dữ liệu mẫu
    const ws = XLSX.utils.json_to_sheet(sampleData);
    
    // Thiết lập width cho các cột
    const colWidths = [
      { wch: 25 }, // Họ và tên
      { wch: 15 }, // Số điện thoại
      { wch: 15 }, // Mã nhân viên
      { wch: 15 }, // Mã phòng ban
      { wch: 10 }  // Role
    ];
    ws['!cols'] = colWidths;
    
    // Thêm worksheet vào workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    
    // Tạo buffer từ workbook
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers và gửi file
    res.setHeader('Content-Disposition', 'attachment; filename=user_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating user template:', error);
    sendErrorResponse(res, 'Lỗi khi tạo file mẫu', 500);
  }
});

// Bulk upload users từ Excel file
export const bulkUploadUsers = asyncHandler(async (req, res) => {
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

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      createdUsers: []
    };

    // Cache departments để tránh query nhiều lần
    const departmentCache = {};
    
    // Hàm helper lấy department id
    const getDepartmentId = async (code) => {
      // Bắt buộc phải có department code
      if (!code) {
        throw new Error('Mã phòng ban là bắt buộc');
      }
      
      if (departmentCache[code]) return departmentCache[code];
      
      const dept = await Department.findOne({ code });
      if (!dept) {
        throw new Error(`Không tìm thấy phòng ban với mã: ${code}`);
      }
      
      // TODO: Có thể thêm logic kiểm tra admin có quyền với department này không nếu cần
      
      departmentCache[code] = dept._id;
      return dept._id;
    };

    // Chuẩn bị default password
    const defaultPasswordStr = process.env.DEFAULT_USER_PASSWORD || 'Admin@123';

    // Xử lý từng dòng dữ liệu
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowIndex = i + 2;
        
        try {
            const fullName = row['Họ và tên'];
            const phone = row['Số điện thoại'];
            const employeeId = row['Mã nhân viên'];
            const departmentCode = row['Mã phòng ban'];
            // Username và Password không còn lấy từ file nữa mà tự sinh/mặc định
            
            let role = row['Role (user, admin)'] || 'user';
            
            // Validate Role
            const validRoles = ['user', 'admin', 'supervisor'];
            if (!validRoles.includes(role)) {
                // Nếu role không hợp lệ, fallback về user hoặc throw error?
                // Ở đây throw error để báo user biết
                throw new Error(`Dòng ${rowIndex}: Role '${role}' không hợp lệ. Chỉ chấp nhận: ${validRoles.join(', ')}`);
            }

            if (!fullName) {
                throw new Error(`Dòng ${rowIndex}: Thiếu họ và tên`);
            }

            if (!employeeId) {
                throw new Error(`Dòng ${rowIndex}: Thiếu mã nhân viên`);
            }

            let departmentId;
            try {
                departmentId = await getDepartmentId(departmentCode);
            } catch (deptError) {
                throw new Error(`Dòng ${rowIndex}: ${deptError.message}`);
            }

            // Generate Username
            const username = createUsername(fullName, employeeId);

            // Kiểm tra username đã tồn tại
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                throw new Error(`Dòng ${rowIndex}: Username '${username}' đã tồn tại (do trùng tên và mã nhân viên)`);
            }

            // Kiểm tra employeeId đã tồn tại
            const existingEmployee = await User.findOne({ employeeId });
            if (existingEmployee) {
                throw new Error(`Dòng ${rowIndex}: Mã nhân viên '${employeeId}' đã tồn tại`);
            }

            const newUser = new User({
                username,
                password: defaultPasswordStr,
                name: fullName,
                phone: phone ? String(phone) : '',
                employeeId: String(employeeId),
                department: departmentId,
                role: role,
                isActive: true
            });

            await newUser.save();
            
            results.createdUsers.push({
                username: newUser.username,
                name: newUser.name,
                employeeId: newUser.employeeId,
                department: departmentCode
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

    const responseData = {
      summary: {
        total: data.length,
        success: results.success,
        failed: results.failed
      },
      createdUsers: results.createdUsers,
      errors: results.errors
    };

    if (results.failed > 0) {
      return res.status(207).json({
        success: true,
        message: `Hoàn thành bulk upload với ${results.success} thành công, ${results.failed} thất bại`,
        data: responseData
      });
    }

    sendSuccessResponse(res, responseData, 'Bulk upload users thành công');

  } catch (error) {
    console.error('Bulk upload users error:', error);
    sendErrorResponse(res, 'Lỗi khi thực hiện bulk upload: ' + error.message, 500);
  }
});
