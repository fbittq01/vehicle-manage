import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';

// Cấu hình multer để xử lý file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware để upload Excel file
export const uploadExcelFile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit cho Excel file
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'), false);
    }
  }
}).single('file');

/**
 * Middleware để xử lý form data và chuyển đổi thành object nested
 */
export const parseAccessLogFormData = (req, res, next) => {
  // Sử dụng multer để parse form data
  upload.any()(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: 'Lỗi khi xử lý form data',
        error: err.message
      });
    }

    try {
      // Chuyển đổi form data thành object nested
      const body = { ...req.body };
      
      // Xử lý recognitionData
      if (body['recognitionData[confidence]']) {
        body.recognitionData = {
          confidence: parseFloat(body['recognitionData[confidence]']),
          processingTime: body['recognitionData[processingTime]'] ? 
            parseInt(body['recognitionData[processingTime]']) : undefined
        };

        // Xử lý boundingBox
        if (body['recognitionData[boundingBox][x]']) {
          body.recognitionData.boundingBox = {
            x: parseInt(body['recognitionData[boundingBox][x]']),
            y: parseInt(body['recognitionData[boundingBox][y]']),
            width: parseInt(body['recognitionData[boundingBox][width]']),
            height: parseInt(body['recognitionData[boundingBox][height]'])
          };
        }

        // Cleanup các field cũ
        Object.keys(body).forEach(key => {
          if (key.startsWith('recognitionData[')) {
            delete body[key];
          }
        });
      }

      // Xử lý deviceInfo nếu có
      if (body['deviceInfo[cameraId]']) {
        body.deviceInfo = {
          cameraId: body['deviceInfo[cameraId]'],
          deviceName: body['deviceInfo[deviceName]'],
          ipAddress: body['deviceInfo[ipAddress]']
        };

        // Cleanup các field cũ
        Object.keys(body).forEach(key => {
          if (key.startsWith('deviceInfo[')) {
            delete body[key];
          }
        });
      }

      // Xử lý weather nếu có
      if (body['weather[temperature]']) {
        body.weather = {
          temperature: parseFloat(body['weather[temperature]']),
          humidity: body['weather[humidity]'] ? parseFloat(body['weather[humidity]']) : undefined,
          condition: body['weather[condition]']
        };

        // Cleanup các field cũ
        Object.keys(body).forEach(key => {
          if (key.startsWith('weather[')) {
            delete body[key];
          }
        });
      }

      // Xử lý files (ảnh base64)
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          if (file.fieldname === 'recognitionData[processedImage]') {
            // Chuyển buffer thành base64
            const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            if (!body.recognitionData) body.recognitionData = {};
            body.recognitionData.processedImage = base64;
          } else if (file.fieldname === 'recognitionData[originalImage]') {
            const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            if (!body.recognitionData) body.recognitionData = {};
            body.recognitionData.originalImage = base64;
          }
        }
      }

      // Cleanup quotes từ form data
      Object.keys(body).forEach(key => {
        if (typeof body[key] === 'string' && body[key].startsWith('"') && body[key].endsWith('"')) {
          body[key] = body[key].slice(1, -1);
        }
      });

      // Replace req.body với processed data
      req.body = body;

      next();
    } catch (error) {
      console.error('Error parsing form data:', error);
      return res.status(400).json({
        success: false,
        message: 'Lỗi khi xử lý dữ liệu form',
        error: error.message
      });
    }
  });
};

/**
 * Generic form data parser cho các nested objects
 */
export const parseFormData = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: 'Lỗi khi xử lý form data',
        error: err.message
      });
    }

    // Parse nested objects từ form data
    const body = {};
    
    Object.keys(req.body).forEach(key => {
      const value = req.body[key];
      
      // Xử lý nested fields như object[field] hoặc object[nested][field]
      if (key.includes('[') && key.includes(']')) {
        const parts = key.split(/[\[\]]+/).filter(Boolean);
        let current = body;
        
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        
        current[parts[parts.length - 1]] = value;
      } else {
        body[key] = value;
      }
    });

    req.body = body;
    next();
  });
};
