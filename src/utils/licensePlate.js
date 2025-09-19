// Utility functions để xử lý biển số xe

// Chuẩn hóa biển số xe
export const normalizeLicensePlate = (licensePlate) => {
  if (!licensePlate) return '';
  
  return licensePlate
    .toString()
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '') // Loại bỏ khoảng trắng
    .replace(/[^0-9A-Z.-]/g, ''); // Chỉ giữ lại số, chữ, dấu chấm và gạch ngang
};

// Validate định dạng biển số xe Việt Nam
export const validateVietnameseLicensePlate = (licensePlate) => {
  const normalized = normalizeLicensePlate(licensePlate);
  
  // Các pattern cho biển số xe Việt Nam
  const patterns = [
    /^[0-9]{2}[A-Z]{1,2}-[0-9]{3,4}\.[0-9]{2}$/, // 29A-123.45
    /^[0-9]{2}[A-Z]{1,2}[0-9]{3,4}$/, // 29A1234 (xe máy)
    /^[0-9]{2}[A-Z]{1}-[0-9]{3}\.[0-9]{2}$/, // 29A-123.45 (ô tô)
    /^[0-9]{2}[A-Z]{2}-[0-9]{4}\.[0-9]{2}$/, // 29AB-1234.56 (ô tô mới)
  ];
  
  return patterns.some(pattern => pattern.test(normalized));
};

// Phân tích thông tin từ biển số xe
export const parseLicensePlate = (licensePlate) => {
  const normalized = normalizeLicensePlate(licensePlate);
  
  if (!validateVietnameseLicensePlate(normalized)) {
    return null;
  }
  
  // Trích xuất mã tỉnh thành
  const provinceCode = normalized.substring(0, 2);
  
  // Map mã tỉnh thành
  const provinceMap = {
    '11': 'Cao Bằng', '12': 'Lạng Sơn', '13': 'Quảng Ninh', '14': 'Hải Phòng',
    '15': 'Hải Dương', '16': 'Hưng Yên', '17': 'Thái Bình', '18': 'Hà Nam',
    '19': 'Nam Định', '20': 'Phú Thọ', '21': 'Thái Nguyên', '22': 'Yên Bái',
    '23': 'Tuyên Quang', '24': 'Hà Giang', '25': 'Lai Châu', '26': 'Sơn La',
    '27': 'Điện Biên', '28': 'Lào Cai', '29': 'Hà Nội', '30': 'Hà Nội',
    '31': 'Hà Nội', '32': 'Hà Nội', '33': 'Hà Nội', '34': 'Hải Dương',
    '35': 'Ninh Bình', '36': 'Thanh Hóa', '37': 'Nghệ An', '38': 'Hà Tĩnh',
    '43': 'Đà Nẵng', '47': 'Đắk Lắk', '49': 'Lâm Đồng', '50': 'TP.HCM',
    '51': 'TP.HCM', '52': 'TP.HCM', '53': 'TP.HCM', '54': 'TP.HCM',
    '55': 'TP.HCM', '56': 'TP.HCM', '57': 'TP.HCM', '58': 'TP.HCM',
    '59': 'TP.HCM', '60': 'Đồng Nai', '61': 'Bình Dương', '62': 'Long An',
    '63': 'Tiền Giang', '64': 'Vĩnh Long', '65': 'Cần Thơ', '66': 'Đồng Tháp',
    '67': 'An Giang', '68': 'Kiên Giang', '69': 'Cà Mau', '70': 'Tây Ninh',
    '71': 'Bến Tre', '72': 'Bà Rịa - Vũng Tàu', '73': 'Quảng Bình',
    '74': 'Quảng Trị', '75': 'Thừa Thiên Huế', '76': 'Quảng Nam',
    '77': 'Quảng Ngãi', '78': 'Bình Định', '79': 'Phú Yên', '81': 'Gia Lai',
    '82': 'Kon Tum', '83': 'Sóc Trăng', '84': 'Trà Vinh', '85': 'Ninh Thuận',
    '86': 'Bình Thuận', '88': 'Vĩnh Phúc', '89': 'Hà Nội', '90': 'Hà Nội',
    '92': 'Hà Nội', '93': 'Bắc Ninh', '94': 'Bắc Giang', '95': 'Hà Nội',
    '97': 'Bắc Kạn', '98': 'Cao Bằng', '99': 'Lào Cai'
  };
  
  return {
    normalized,
    provinceCode,
    provinceName: provinceMap[provinceCode] || 'Không xác định',
    isValid: true
  };
};

// Tạo suggestions cho biển số xe (cho autocomplete)
export const generateLicensePlateSuggestions = (input) => {
  const normalized = normalizeLicensePlate(input);
  const suggestions = [];
  
  if (normalized.length >= 2) {
    const provinceCode = normalized.substring(0, 2);
    // Có thể thêm logic để suggest dựa trên province code
  }
  
  return suggestions;
};

// Format hiển thị biển số xe
export const formatLicensePlateDisplay = (licensePlate) => {
  const normalized = normalizeLicensePlate(licensePlate);
  
  // Thêm dấu gạch ngang và chấm cho dễ đọc nếu chưa có
  if (/^[0-9]{2}[A-Z]{1,2}[0-9]{3,4}$/.test(normalized)) {
    // Format cho xe máy: 29A1234 -> 29A-1234
    const match = normalized.match(/^([0-9]{2}[A-Z]{1,2})([0-9]{3,4})$/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
  }
  
  return normalized;
};
