import Joi from 'joi';

// Helper function để validate request
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đầu vào không hợp lệ',
        errors
      });
    }
    
    next();
  };
};

// Validation schemas
export const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.alphanum': 'Username chỉ được chứa chữ cái và số',
      'string.min': 'Username phải có ít nhất 3 ký tự',
      'string.max': 'Username không được vượt quá 50 ký tự',
      'any.required': 'Username là bắt buộc'
    }),
  password: Joi.string()
    .min(6)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .required()
    .messages({
      'string.min': 'Mật khẩu phải có ít nhất 6 ký tự',
      'string.pattern.base': 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
      'any.required': 'Mật khẩu là bắt buộc'
    }),
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Tên phải có ít nhất 2 ký tự',
      'string.max': 'Tên không được vượt quá 100 ký tự',
      'any.required': 'Tên là bắt buộc'
    }),
  phone: Joi.string()
    .pattern(/^[0-9]{10,11}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Số điện thoại phải có 10-11 chữ số'
    }),
  department: Joi.string()
    .max(100)
    .optional(),
  employeeId: Joi.string()
    .max(50)
    .optional(),
  role: Joi.string()
    .valid('admin', 'user')
    .optional()
});

export const loginSchema = Joi.object({
  username: Joi.string()
    .required()
    .messages({
      'any.required': 'Username là bắt buộc'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Mật khẩu là bắt buộc'
    })
});

export const vehicleSchema = Joi.object({
  licensePlate: Joi.string()
    .pattern(/^[0-9]{2}[A-Z]{1,2}-[0-9]{3,4}\.[0-9]{2}$|^[0-9]{2}[A-Z]{1,2}[0-9]{3,4}$/)
    .required()
    .messages({
      'string.pattern.base': 'Biển số xe không đúng định dạng',
      'any.required': 'Biển số xe là bắt buộc'
    }),
  owner: Joi.string()
    .required()
    .messages({
      'any.required': 'Chủ sở hữu là bắt buộc'
    }),
  vehicleType: Joi.string()
    .valid('car', 'motorcycle', 'truck', 'bus', 'bicycle', 'other')
    .required()
    .messages({
      'any.only': 'Loại xe không hợp lệ',
      'any.required': 'Loại xe là bắt buộc'
    }),
  name: Joi.string()
    .max(100)
    .optional(),
  color: Joi.string()
    .max(30)
    .optional(),
  description: Joi.string()
    .max(500)
    .optional(),
  expiryDate: Joi.date()
    .optional()
});

export const updateVehicleSchema = vehicleSchema.fork(['licensePlate', 'owner', 'vehicleType'], (schema) => schema.optional());

export const accessLogSchema = Joi.object({
  licensePlate: Joi.string()
    .required()
    .messages({
      'any.required': 'Biển số xe là bắt buộc'
    }),
  action: Joi.string()
    .valid('entry', 'exit')
    .required()
    .messages({
      'any.only': 'Hành động phải là entry hoặc exit',
      'any.required': 'Hành động là bắt buộc'
    }),
  gateId: Joi.string()
    .required()
    .messages({
      'any.required': 'ID cổng là bắt buộc'
    }),
  gateName: Joi.string()
    .max(100)
    .optional(),
  recognitionData: Joi.object({
    confidence: Joi.number()
      .min(0)
      .max(1)
      .required(),
    processedImage: Joi.string().optional(),
    originalImage: Joi.string().optional(),
    boundingBox: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
      width: Joi.number().required(),
      height: Joi.number().required()
    }).optional(),
    processingTime: Joi.number().min(0).optional()
  }).required(),
  deviceInfo: Joi.object({
    cameraId: Joi.string().optional(),
    deviceName: Joi.string().optional(),
    ipAddress: Joi.string().ip().optional()
  }).optional(),
  weather: Joi.object({
    condition: Joi.string().optional(),
    temperature: Joi.number().optional(),
    humidity: Joi.number().min(0).max(100).optional()
  }).optional()
});

export const updateUserSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .optional(),
  phone: Joi.string()
    .pattern(/^[0-9]{10,11}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Số điện thoại phải có 10-11 chữ số'
    }),
  department: Joi.string()
    .max(100)
    .optional(),
  employeeId: Joi.string()
    .max(50)
    .optional(),
  role: Joi.string()
    .valid('admin', 'user')
    .optional(),
  isActive: Joi.boolean()
    .optional()
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Mật khẩu hiện tại là bắt buộc'
    }),
  newPassword: Joi.string()
    .min(6)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .required()
    .messages({
      'string.min': 'Mật khẩu mới phải có ít nhất 6 ký tự',
      'string.pattern.base': 'Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
      'any.required': 'Mật khẩu mới là bắt buộc'
    })
});

export const cameraSchema = Joi.object({
  cameraId: Joi.string()
    .max(50)
    .required()
    .messages({
      'any.required': 'ID camera là bắt buộc',
      'string.max': 'ID camera không được vượt quá 50 ký tự'
    }),
  name: Joi.string()
    .max(100)
    .required()
    .messages({
      'any.required': 'Tên camera là bắt buộc',
      'string.max': 'Tên camera không được vượt quá 100 ký tự'
    }),
  description: Joi.string()
    .max(500)
    .optional(),
  location: Joi.object({
    gateId: Joi.string()
      .required()
      .messages({
        'any.required': 'ID cổng là bắt buộc'
      }),
    gateName: Joi.string()
      .max(100)
      .optional(),
    position: Joi.string()
      .valid('entry', 'exit', 'both')
      .optional(),
    coordinates: Joi.object({
      latitude: Joi.number()
        .min(-90)
        .max(90)
        .optional(),
      longitude: Joi.number()
        .min(-180)
        .max(180)
        .optional()
    }).optional()
  }).required(),
  technical: Joi.object({
    ipAddress: Joi.string()
      .ip()
      .optional(),
    port: Joi.number()
      .min(1)
      .max(65535)
      .optional(),
    protocol: Joi.string()
      .valid('http', 'https', 'rtsp', 'rtmp', 'onvif')
      .optional(),
    username: Joi.string()
      .max(50)
      .optional(),
    password: Joi.string()
      .max(100)
      .optional(),
    streamUrl: Joi.string()
      .max(500)
      .optional(),
    resolution: Joi.object({
      width: Joi.number().min(1).optional(),
      height: Joi.number().min(1).optional()
    }).optional(),
    fps: Joi.number()
      .min(1)
      .max(120)
      .optional()
  }).optional(),
  recognition: Joi.object({
    enabled: Joi.boolean().optional(),
    confidence: Joi.object({
      threshold: Joi.number().min(0).max(1).optional(),
      autoApprove: Joi.number().min(0).max(1).optional()
    }).optional(),
    roi: Joi.object({
      x: Joi.number().min(0).optional(),
      y: Joi.number().min(0).optional(),
      width: Joi.number().min(1).optional(),
      height: Joi.number().min(1).optional()
    }).optional(),
    processingInterval: Joi.number().min(100).optional()
  }).optional(),
  managedBy: Joi.string().optional(),
  manufacturer: Joi.string().max(100).optional(),
  model: Joi.string().max(100).optional(),
  serialNumber: Joi.string().max(100).optional(),
  warrantyExpiry: Joi.date().optional(),
  maintenance: Joi.object({
    maintenanceInterval: Joi.number().min(1).optional()
  }).optional()
});

export const updateCameraSchema = cameraSchema.fork(['cameraId', 'name', 'location'], (schema) => schema.optional());

// Export validation middleware
export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateVehicle = validate(vehicleSchema);
export const validateUpdateVehicle = validate(updateVehicleSchema);
export const validateAccessLog = validate(accessLogSchema);
export const validateUpdateUser = validate(updateUserSchema);
export const validateChangePassword = validate(changePasswordSchema);
export const validateCamera = validate(cameraSchema);
export const validateUpdateCamera = validate(updateCameraSchema);
