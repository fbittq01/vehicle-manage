// Utility functions để xử lý biển số xe

/**
 * Định nghĩa các loại biển số xe Việt Nam
 * Mỗi pattern gồm: regex để match, hàm format kết quả
 */
const LICENSE_PLATE_PATTERNS = [
  // === XE ĐẶC BIỆT (prefix chữ) ===
  {
    name: 'Xe quân đội',
    match: /^(QĐ|QD)(\d{4,5})$/,
    format: (m) => `${m[1]}-${m[2]}`
  },
  {
    name: 'Xe công an',
    match: /^(CA)(\d{4,5})$/,
    format: (m) => `${m[1]}-${m[2]}`
  },
  {
    name: 'Xe ngoại giao',
    match: /^(NG|NN|QT|ĐN|Đ)(\d{4,6})$/,
    format: (m) => `${m[1]}-${m[2]}`
  },
  
  // === Ô TÔ (6 số cuối, có dấu chấm) ===
  {
    name: 'Ô tô mới (2 chữ)',
    match: /^(\d{2}[A-Z]{2})(\d{4})(\d{2})$/,
    format: (m) => `${m[1]}-${m[2]}.${m[3]}`
  },
  
  // === XE MÁY (5 số cuối, có dấu chấm) ===
  {
    name: 'Xe máy mới (2 chữ)',
    match: /^(\d{2}[A-Z]{2})(\d{3})(\d{2})$/,
    format: (m) => `${m[1]}-${m[2]}.${m[3]}`
  },
  {
    name: 'Xe máy mới (1 chữ + 1 số)',
    match: /^(\d{2}[A-Z]\d)(\d{3})(\d{2})$/,
    format: (m) => `${m[1]}-${m[2]}.${m[3]}`
  },
  {
    name: 'Ô tô cũ (1 chữ)',
    match: /^(\d{2}[A-Z])(\d{3})(\d{2})$/,
    format: (m) => `${m[1]}-${m[2]}.${m[3]}`
  },
  
  // === XE MÁY (4 số cuối, không dấu chấm) ===
  {
    name: 'Xe máy (1 chữ + 1 số + 4 số)',
    match: /^(\d{2}[A-Z]\d)(\d{4})$/,
    format: (m) => `${m[1]}-${m[2]}`
  },
  {
    name: 'Xe máy cũ (4 số)',
    match: /^(\d{2}[A-Z])(\d{4})$/,
    format: (m) => `${m[1]}-${m[2]}`
  },
  
  // === XE TẢI, BUS (5 số cuối, không dấu chấm) ===
  {
    name: 'Xe tải/bus',
    match: /^(\d{2}[A-Z])(\d{5})$/,
    format: (m) => `${m[1]}-${m[2]}`
  },
];

/**
 * Chuẩn hóa biển số xe Việt Nam
 */
export const normalizeLicensePlate = (licensePlate) => {
  if (!licensePlate) return '';
  
  // Làm sạch input: uppercase, bỏ khoảng trắng và ký tự không hợp lệ
  const cleanPlate = licensePlate
    .toString()
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^0-9A-ZĐ]/g, '');
  
  if (!cleanPlate) return '';
  
  // Tìm pattern phù hợp và format
  for (const pattern of LICENSE_PLATE_PATTERNS) {
    const match = cleanPlate.match(pattern.match);
    if (match) {
      return pattern.format(match);
    }
  }
  
  // Fallback: trả về bản gốc đã làm sạch
  return cleanPlate;
};

/**
 * Validate định dạng biển số xe Việt Nam
 * Sử dụng normalizeLicensePlate và kiểm tra kết quả có khớp pattern hợp lệ không
 */
export const validateVietnameseLicensePlate = (licensePlate) => {
  const normalized = normalizeLicensePlate(licensePlate);
  
  if (!normalized || normalized.length < 6) return false;
  
  // Các pattern validation cho output đã normalize
  const validPatterns = [
    // Xe đặc biệt
    /^(QĐ|QD)-\d{4,5}$/,
    /^CA-\d{4,5}$/,
    /^(NG|NN|QT|ĐN|Đ)-\d{4,6}$/,
    // Ô tô/Xe máy có dấu chấm
    /^\d{2}[A-Z]{1,2}-\d{3,4}\.\d{2}$/,
    // Xe máy/Xe tải không dấu chấm
    /^\d{2}[A-Z]\d?-\d{4,5}$/,
  ];
  
  return validPatterns.some(pattern => pattern.test(normalized));
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

/**
 * Format hiển thị biển số xe
 * Sử dụng hàm normalizeLicensePlate để chuẩn hóa, sau đó trả về dạng hiển thị
 */
export const formatLicensePlateDisplay = (licensePlate) => {
  // Sử dụng hàm normalizeLicensePlate đã có
  const normalized = normalizeLicensePlate(licensePlate);
  
  // Trả về biển số đã được chuẩn hóa
  return normalized;
};

