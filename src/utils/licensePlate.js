/**
 * Chuẩn hóa biển số xe về dạng chuỗi ký tự liền mạch (A-Z0-9).
 * Loại bỏ khoảng trắng, dấu chấm, dấu gạch ngang và các ký tự đặc biệt.
 * Ví dụ: "29-M1 123.45" -> "29M112345"
 * * @param {string} plate - Biển số xe thô (raw input)
 * @returns {string} Biển số đã chuẩn hóa
 */
export const normalizeLicensePlate = (plate) => {
    if (!plate) return "";
    // 1. Chuyển thành chữ in hoa
    // 2. Thay thế tất cả ký tự KHÔNG PHẢI là chữ (A-Z) hoặc số (0-9) bằng chuỗi rỗng
    return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

/**
 * Kiểm tra tính hợp lệ của biển số xe Việt Nam dựa trên dữ liệu mẫu.
 * Hỗ trợ:
 * - Xe máy/Ô tô 5 số (VD: 29M1-923.03, 30F-254.38)
 * - Xe máy/Ô tô 4 số cũ (VD: 30S-4894)
 * - Xe máy điện/Xe 50cc (VD: 29AA-63254)
 * - Xe quân sự/đặc biệt (VD: TN-354)
 * * @param {string} plate - Biển số xe cần kiểm tra
 * @returns {boolean} True nếu hợp lệ, False nếu không hợp lệ
 */
export const validateVietnameseLicensePlate = (plate) => {
    const cleanPlate = normalizeLicensePlate(plate);

    // Kiểm tra độ dài cơ bản sau khi clean (ngắn nhất là 5 ký tự cho xe quân sự, dài nhất là 9 ký tự)
    if (cleanPlate.length < 5 || cleanPlate.length > 9) {
        return false;
    }

    /**
     * REGEX 1: XE DÂN SỰ (Civilian)
     * Cấu trúc: [Mã tỉnh][Series][Số]
     * ^(\d{2})        : Bắt đầu bằng 2 số (Mã tỉnh, VD: 29, 30, 59...)
     * ([A-Z][A-Z0-9]?): Series. Có thể là 1 chữ cái (VD: 30L) hoặc 1 chữ + 1 số (VD: 29M1) hoặc 2 chữ (VD: 29AA)
     * (\d{4,5})$      : Kết thúc bằng 4 hoặc 5 chữ số
     */
    const civilianRegex = /^(\d{2})([A-Z][A-Z0-9]?)(\d{4,5})$/;

    /**
     * REGEX 2: XE QUÂN SỰ / ĐẶC BIỆT (Army/Special)
     * Dựa trên mẫu data: "TN-354"
     * ^([A-Z]{2}) : Bắt đầu bằng 2 chữ cái (VD: TN, TM, KD...)
     * (\d{3,5})$  : Theo sau là 3 đến 5 chữ số
     */
    const armyRegex = /^([A-Z]{2})(\d{3,5})$/;

    // Trả về true nếu khớp 1 trong 2 định dạng
    return civilianRegex.test(cleanPlate) || armyRegex.test(cleanPlate);
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

/**
 * Format biển số xe về dạng đẹp, dễ đọc.
 * Dựa trên dữ liệu thực tế từ Book1.xlsx:
 * 
 * XE MÁY (motorcycle) - 5 số có dấu chấm:
 * - Series 2 chữ + 5 số: "29AA-63254" → "29AA-632.54"
 * - Series 1 chữ + 1 số + 5 số: "29M1-923.03" → "29M1-923.03"
 * 
 * XE MÁY (motorcycle) - 4 số không có dấu chấm:
 * - Series 1 chữ + 1 số + 4 số: "29Y2-5306" → "29Y2-5306"
 * - Series 1 chữ + 4 số: "30S-4894" → "30S-4894"
 * 
 * Ô TÔ (car) - 5 số có dấu chấm:
 * - Series 1 chữ + 5 số: "30F-25438" → "30F-254.38"
 * 
 * XE QUÂN SỰ:
 * - "TN-354" → "TN-354"
 * 
 * @param {string} plate - Biển số xe (có thể đã hoặc chưa chuẩn hóa)
 * @returns {string} Biển số đã được format đẹp
 */
export const formatLicensePlate = (plate) => {
  if (!plate) return "";
  
  const cleanPlate = normalizeLicensePlate(plate);
  
  // Kiểm tra độ dài tối thiểu
  if (cleanPlate.length < 5) {
    return cleanPlate;
  }
  
  // === BIỂN 9 KÝ TỰ (2 số tỉnh + 2 chữ series + 5 số) ===
  // REGEX 1: XE MÁY - Series 2 chữ cái (AA) + 5 số (VD: 29AA63254 -> 29AA-632.54)
  // Mẫu: 29AA-63254, 29BN-02787
  const motorcycle2Letter5DigitRegex = /^(\d{2})([A-Z]{2})(\d{5})$/;
  const match2Letter5Digit = cleanPlate.match(motorcycle2Letter5DigitRegex);
  if (match2Letter5Digit) {
    const [, province, series, numbers] = match2Letter5Digit;
    return `${province}${series}-${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  }
  
  // === BIỂN 9 KÝ TỰ (2 số tỉnh + 1 chữ + 1 số series + 5 số) ===
  // REGEX 2: XE MÁY - Series 1 chữ + 1 số + 5 số (VD: 29M192303 -> 29M1-923.03)
  // Mẫu: 29M1-923.03, 29L1-239.94, 29X5-38909
  const motorcycle1Letter1Digit5DigitRegex = /^(\d{2})([A-Z])(\d)(\d{5})$/;
  const match1Letter1Digit5Digit = cleanPlate.match(motorcycle1Letter1Digit5DigitRegex);
  if (match1Letter1Digit5Digit) {
    const [, province, letter, seriesDigit, numbers] = match1Letter1Digit5Digit;
    return `${province}${letter}${seriesDigit}-${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  }
  
  // === BIỂN 8 KÝ TỰ - Cần phân biệt dựa trên format input ===
  if (cleanPlate.length === 8) {
    // Phân tích input gốc để xác định format
    const originalPlate = plate.toUpperCase().trim();
    
    // Pattern xe máy: có format XX[chữ][số]-XXXX (dấu gạch ngang sau 4 ký tự đầu)
    // VD: 29Y2-5306, 29H7-1452, 30N9-6749
    const motorcycleInputPattern = /^\d{2}[A-Z]\d[\s\-\.]+\d{4}$/;
    if (motorcycleInputPattern.test(originalPlate.replace(/\s+/g, ''))) {
      const match = cleanPlate.match(/^(\d{2})([A-Z])(\d)(\d{4})$/);
      if (match) {
        const [, province, letter, seriesDigit, numbers] = match;
        return `${province}${letter}${seriesDigit}-${numbers}`;
      }
    }
    
    // Pattern ô tô: có format XX[chữ]-XXXXX hoặc XX[chữ] XXXXX (dấu gạch ngang/khoảng trắng sau 3 ký tự đầu)
    // VD: 30F-25438, 30L 54854, 29A-53383
    const carInputPattern = /^\d{2}[A-Z][\s\-\.]+\d{5}$/;
    if (carInputPattern.test(originalPlate)) {
      const match = cleanPlate.match(/^(\d{2})([A-Z])(\d{5})$/);
      if (match) {
        const [, province, series, numbers] = match;
        return `${province}${series}-${numbers.slice(0, 3)}.${numbers.slice(3)}`;
      }
    }
    
    // Nếu không xác định được từ input, mặc định format như ô tô (1 chữ + 5 số)
    // vì đây là format phổ biến hơn cho biển 8 ký tự
    const defaultMatch = cleanPlate.match(/^(\d{2})([A-Z])(\d{5})$/);
    if (defaultMatch) {
      const [, province, series, numbers] = defaultMatch;
      return `${province}${series}-${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    }
  }
  
  // === BIỂN 7 KÝ TỰ (2 số tỉnh + 1 chữ + 4 số) ===
  // REGEX: XE MÁY/Ô TÔ - Series 1 chữ + 4 số (VD: 30S4894 -> 30S-4894)
  // Mẫu: 30S-4894
  const vehicle1Letter4DigitRegex = /^(\d{2})([A-Z])(\d{4})$/;
  const matchVehicle1Letter4Digit = cleanPlate.match(vehicle1Letter4DigitRegex);
  if (matchVehicle1Letter4Digit) {
    const [, province, series, numbers] = matchVehicle1Letter4Digit;
    return `${province}${series}-${numbers}`;
  }
  
  // === XE QUÂN SỰ / ĐẶC BIỆT ===
  // REGEX: (VD: TN354 -> TN-354)
  // Mẫu: TN-354
  const armyRegex = /^([A-Z]{2})(\d{3,5})$/;
  const matchArmy = cleanPlate.match(armyRegex);
  if (matchArmy) {
    const [, prefix, numbers] = matchArmy;
    return `${prefix}-${numbers}`;
  }
  
  // Fallback: trả về biển số đã normalize
  return cleanPlate;
};

