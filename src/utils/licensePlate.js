// Utility functions để xử lý biển số xe

// Chuẩn hóa biển số xe
export const normalizeLicensePlate = (licensePlate) => {
  if (!licensePlate) return '';
  
  // Làm sạch input
  let normalized = licensePlate
    .toString()
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '') // Loại bỏ khoảng trắng
    .replace(/[^0-9A-Z.-]/g, ''); // Chỉ giữ lại số, chữ, dấu chấm và gạch ngang
  
  // Nếu đã có định dạng chuẩn thì trả về luôn
  if (normalized.includes('-') && normalized.includes('.')) {
    return normalized;
  }
  
  // Loại bỏ dấu gạch ngang và chấm hiện có để format lại
  const cleanLicensePlate = normalized.replace(/[-.]/, '');
  
  // Thêm định dạng cho các loại biển số xe
  
  // Ô tô con cũ: 29A12345 -> 29A-123.45
  if (/^[0-9]{2}[A-Z]{1}[0-9]{5}$/.test(cleanLicensePlate)) {
    const match = cleanLicensePlate.match(/^([0-9]{2}[A-Z]{1})([0-9]{3})([0-9]{2})$/);
    if (match) {
      return `${match[1]}-${match[2]}.${match[3]}`;
    }
  }
  
  // Ô tô con mới: 29AB123456 -> 29AB-1234.56
  if (/^[0-9]{2}[A-Z]{2}[0-9]{6}$/.test(cleanLicensePlate)) {
    const match = cleanLicensePlate.match(/^([0-9]{2}[A-Z]{2})([0-9]{4})([0-9]{2})$/);
    if (match) {
      return `${match[1]}-${match[2]}.${match[3]}`;
    }
  }
  
  // Biển số quân đội: HC3257 -> HC-3257 (2 chữ + 4 số)
  if (/^[A-Z]{2}[0-9]{4}$/.test(cleanLicensePlate)) {
    const match = cleanLicensePlate.match(/^([A-Z]{2})([0-9]{4})$/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
  }
  
  // Nếu không khớp pattern nào thì trả về bản gốc đã làm sạch
  return normalized;
};

// Validate định dạng biển số xe Việt Nam
export const validateVietnameseLicensePlate = (licensePlate) => {
  const normalized = normalizeLicensePlate(licensePlate);
  
  // Các pattern cho biển số xe Việt Nam
  const patterns = [
    // Ô tô con cũ: 29A-123.45
    /^[0-9]{2}[A-Z]{1}-[0-9]{3}\.[0-9]{2}$/,
    // Ô tô con mới: 29AB-1234.56  
    /^[0-9]{2}[A-Z]{2}-[0-9]{4}\.[0-9]{2}$/,
    // Xe máy cũ: 29A1-1234, 29A-1234
    /^[0-9]{2}[A-Z]{1}[0-9]{1}-[0-9]{4}$/,
    /^[0-9]{2}[A-Z]{1}-[0-9]{4}$/,
    // Xe máy mới: 29A11234, 30F91760 (2 số + 1 chữ + 5 số)
    /^[0-9]{2}[A-Z]{1}[0-9]{5}$/,
    // Xe máy: 29A1234 (2 số + 1 chữ + 4 số)
    /^[0-9]{2}[A-Z]{1}[0-9]{4}$/,
    // Xe tải, container: 29C-12345
    /^[0-9]{2}[A-Z]{1}-[0-9]{5}$/,
    // Xe buýt: 29B-12345
    /^[0-9]{2}[A-Z]{1}-[0-9]{5}$/,
    // Format có dấu gạch ngang: 29A-123.45
    /^[0-9]{2}[A-Z]{1,2}-[0-9]{3,5}(\.[0-9]{2})?$/,
    // Biển số quân đội: HC-3257, QD-1234, CA-5678 (2 chữ cái + 4 số)
    /^[A-Z]{2}-[0-9]{4}$/,
    // Biển số quân đội không có gạch ngang: HC3257, QD1234 (2 chữ cái + 4 số)
    /^[A-Z]{2}[0-9]{4}$/,
  ];
  
  return patterns.some(pattern => pattern.test(normalized));
};

// Phân tích thông tin từ biển số xe
export const parseLicensePlate = (licensePlate) => {
  const normalized = normalizeLicensePlate(licensePlate);
  
  if (!validateVietnameseLicensePlate(normalized)) {
    return null;
  }
  
  // Kiểm tra nếu là biển số quân đội (2 chữ cái + 4 số)
  if (/^[A-Z]{2}[-]?[0-9]{4}$/.test(normalized)) {
    const militaryCode = normalized.substring(0, 2);
    
    // Map mã biển số quân đội
    const militaryMap = {
      'QD': 'Quân đội',
      'HC': 'Hậu cần quân đội',
      'TQ': 'Tổng cục Kỹ thuật',
      'TC': 'Tổng cục Chính trị',
      'BT': 'Ban Tổng tham mưu',
      'BK': 'Bộ Quốc phòng',
      'CA': 'Công an',
      'CS': 'Cảnh sát',
      'PC': 'Phòng cháy chữa cháy',
      'GT': 'Giao thông',
      'BD': 'Bộ đội biên phòng',
      'HQ': 'Hải quan',
      'NG': 'Ngoại giao',
      'QT': 'Quốc tế'
    };
    
    return {
      normalized,
      militaryCode,
      organizationName: militaryMap[militaryCode] || 'Cơ quan nhà nước',
      type: 'military',
      isValid: true
    };
  }
  
  // Trích xuất mã tỉnh thành cho biển số dân sự
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
    type: 'civilian',
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
  
  // Xe máy 5 số: 30F91760 -> 30F-91760
  if (/^[0-9]{2}[A-Z]{1}[0-9]{5}$/.test(normalized)) {
    const match = normalized.match(/^([0-9]{2}[A-Z]{1})([0-9]{5})$/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
  }
  
  // Xe máy 4 số: 29A1234 -> 29A-1234
  if (/^[0-9]{2}[A-Z]{1}[0-9]{4}$/.test(normalized)) {
    const match = normalized.match(/^([0-9]{2}[A-Z]{1})([0-9]{4})$/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
  }
  
  // Biển số quân đội: HC3257 -> HC-3257 (2 chữ + 4 số)
  if (/^[A-Z]{2}[0-9]{4}$/.test(normalized)) {
    const match = normalized.match(/^([A-Z]{2})([0-9]{4})$/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
  }
  
  return normalized;
};
