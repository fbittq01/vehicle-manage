import rateLimit from 'express-rate-limit';

// Rate limiting chung
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 phút
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting cho đăng nhập (nghiêm ngặt hơn)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // 10 attempts per window
  message: {
    success: false,
    message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 15 phút.'
  },
  skipSuccessfulRequests: true, // Không đếm requests thành công
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting cho đăng ký
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3, // 3 registrations per hour
  message: {
    success: false,
    message: 'Quá nhiều lần đăng ký từ IP này, vui lòng thử lại sau 1 giờ.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting cho API nhận diện biển số (có thể nhận nhiều requests)
export const recognitionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 60, // 60 recognition requests per minute
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu nhận diện biển số, vui lòng thử lại sau.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting cho password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3, // 3 password reset attempts per hour
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu đặt lại mật khẩu, vui lòng thử lại sau 1 giờ.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
