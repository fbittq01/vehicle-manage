import ActivityLogger from '../services/activityLogger.js';

const activityMiddleware = (action, resource = null) => {
  return async (req, res, next) => {
    // Sử dụng res.on('finish') để bắt khi response đã được gửi hoàn toàn
    res.on('finish', () => {
      logActivity(req, res, action, resource);
    });

    next();
  };
};

async function logActivity(req, res, action, resource) {
  // Ghi log sau khi response được gửi
  setImmediate(async () => {
    try {
      const userId = req.user ? req.user.id : null;
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.get('User-Agent') || 'Unknown';
      
      let resourceId = null;
      let details = null;
      let status = 'SUCCESS';
      let errorMessage = null;

      // Kiểm tra status code để xác định success/failed
      if (res.statusCode >= 400) {
        status = 'FAILED';
        errorMessage = res.statusMessage || 'Request failed';
      }

      // Lấy resourceId từ params nếu có
      if (req.params.id) {
        resourceId = req.params.id;
      }

      // Tạo details từ request body (loại bỏ sensitive data)
      if (req.body && Object.keys(req.body).length > 0) {
        const { password, token, confirmPassword, oldPassword, newPassword, ...safeBody } = req.body;
        details = safeBody;
      }

      // Thêm query params vào details nếu có
      if (req.query && Object.keys(req.query).length > 0) {
        details = details || {};
        details.queryParams = req.query;
      }

      // Thêm method và path vào details
      details = details || {};
      details.method = req.method;
      details.path = req.path;

      // Chỉ log nếu có userId (user đã đăng nhập)
      if (userId) {
        await ActivityLogger.log({
          userId,
          action,
          resource,
          resourceId,
          details,
          ipAddress,
          userAgent,
          status,
          errorMessage
        });
      }
    } catch (error) {
      console.error('Activity logging error:', error);
    }
  });
}

export default activityMiddleware;
