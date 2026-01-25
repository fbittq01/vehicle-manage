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

// Update Access Log Info Schema
export const updateAccessLogInfoSchema = Joi.object({
  licensePlate: Joi.string()
    .pattern(/^[0-9]{2}[A-Z]{1,2}[\s\-]?[0-9]{3,5}$/)
    .required()
    .messages({
      'string.pattern.base': 'Biển số xe không đúng định dạng (VD: 29A-12345)',
      'any.required': 'Biển số xe là bắt buộc'
    }),
  confidence: Joi.number()
    .min(0)
    .max(1)
    .optional()
    .messages({
      'number.min': 'Độ tin cậy phải từ 0 đến 1',
      'number.max': 'Độ tin cậy phải từ 0 đến 1'
    }),
  note: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Ghi chú không được vượt quá 500 ký tự'
    })
});

// Verify Access Log Schema
export const verifyAccessLogSchema = Joi.object({
  status: Joi.string()
    .valid('approved', 'rejected')
    .required()
    .messages({
      'any.only': 'Trạng thái chỉ có thể là approved hoặc rejected',
      'any.required': 'Trạng thái verify là bắt buộc'
    }),
  note: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Ghi chú không được vượt quá 500 ký tự'
    }),
  correctedData: Joi.object({
    licensePlate: Joi.string()
      .required()
      .messages({
        'any.required': 'Biển số xe là bắt buộc khi sửa thông tin'
      }),
    confidence: Joi.number()
      .min(0)
      .max(1)
      .optional()
      .messages({
        'number.min': 'Độ tin cậy phải từ 0 đến 1',
        'number.max': 'Độ tin cậy phải từ 0 đến 1'
      })
  }).optional(),
  guestInfo: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Tên khách phải có ít nhất 2 ký tự',
        'string.max': 'Tên khách không được vượt quá 100 ký tự',
        'any.required': 'Tên khách là bắt buộc'
      }),
    phone: Joi.string()
      .pattern(/^[0-9]{10,11}$/)
      .required()
      .messages({
        'string.pattern.base': 'Số điện thoại phải có 10-11 chữ số',
        'any.required': 'Số điện thoại là bắt buộc'
      }),
    idCard: Joi.string()
      .max(20)
      .optional(),
    hometown: Joi.string()
      .max(200)
      .optional(),
    visitPurpose: Joi.string()
      .max(200)
      .optional(),
    contactPerson: Joi.string()
      .max(100)
      .optional(),
    notes: Joi.string()
      .max(500)
      .optional()
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
  }).optional(),
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

// Working Hours validation schemas
export const workingHoursSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.min': 'Tên cài đặt không được để trống',
      'string.max': 'Tên cài đặt không được vượt quá 100 ký tự',
      'any.required': 'Tên cài đặt là bắt buộc'
    }),
  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Giờ bắt đầu phải có định dạng HH:mm (ví dụ: 08:00)',
      'any.required': 'Giờ bắt đầu là bắt buộc'
    }),
  endTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Giờ kết thúc phải có định dạng HH:mm (ví dụ: 17:00)',
      'any.required': 'Giờ kết thúc là bắt buộc'
    }),
  workingDays: Joi.array()
    .items(Joi.number().integer().min(0).max(6))
    .min(1)
    .max(7)
    .unique()
    .required()
    .messages({
      'array.min': 'Phải có ít nhất 1 ngày làm việc',
      'array.max': 'Không thể có quá 7 ngày làm việc',
      'array.unique': 'Các ngày làm việc không được trùng lặp',
      'number.min': 'Ngày làm việc phải từ 0 (Chủ nhật) đến 6 (Thứ 7)',
      'number.max': 'Ngày làm việc phải từ 0 (Chủ nhật) đến 6 (Thứ 7)',
      'any.required': 'Ngày làm việc là bắt buộc'
    }),
  lateToleranceMinutes: Joi.number()
    .integer()
    .min(0)
    .max(120)
    .default(30)
    .optional()
    .messages({
      'number.min': 'Thời gian cho phép muộn không thể âm',
      'number.max': 'Thời gian cho phép muộn không được vượt quá 120 phút',
      'number.integer': 'Thời gian cho phép muộn phải là số nguyên'
    }),
  earlyToleranceMinutes: Joi.number()
    .integer()
    .min(0)
    .max(120)
    .default(30)
    .optional()
    .messages({
      'number.min': 'Thời gian cho phép về sớm không thể âm',
      'number.max': 'Thời gian cho phép về sớm không được vượt quá 120 phút',
      'number.integer': 'Thời gian cho phép về sớm phải là số nguyên'
    }),
  description: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Mô tả không được vượt quá 500 ký tự'
    }),
  isActive: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Trạng thái hoạt động phải là true hoặc false'
    })
})

export const updateWorkingHoursSchema = workingHoursSchema.fork(['name', 'startTime', 'endTime', 'workingDays'], (schema) => schema.optional());

// Validation cho query parameter check working time
export const checkWorkingTimeSchema = Joi.object({
  dateTime: Joi.alternatives()
    .try(
      Joi.date().iso(),
      Joi.string().isoDate(),
      Joi.number().integer().positive()
    )
    .required()
    .messages({
      'alternatives.match': 'dateTime phải là định dạng ISO date, timestamp hoặc date object hợp lệ',
      'any.required': 'dateTime là bắt buộc'
    })
});

// Validation cho route parameters
export const workingHoursParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID không hợp lệ',
      'any.required': 'ID là bắt buộc'
    })
});

// Validation cho query parameters của getWorkingHours
export const workingHoursQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional(),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional(),
  isActive: Joi.string()
    .valid('true', 'false')
    .optional()
});

// Department validation schemas
export const departmentSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.min': 'Tên phòng ban không được để trống',
      'string.max': 'Tên phòng ban không được vượt quá 100 ký tự',
      'any.required': 'Tên phòng ban là bắt buộc'
    }),
  code: Joi.string()
    .min(1)
    .max(20)
    .uppercase()
    .trim()
    .pattern(/^[A-Z0-9_]+$/)
    .required()
    .messages({
      'string.min': 'Mã phòng ban không được để trống',
      'string.max': 'Mã phòng ban không được vượt quá 20 ký tự',
      'string.pattern.base': 'Mã phòng ban chỉ được chứa chữ cái viết hoa, số và dấu gạch dưới',
      'any.required': 'Mã phòng ban là bắt buộc'
    }),
  description: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Mô tả không được vượt quá 500 ký tự'
    }),
  manager: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Manager ID không hợp lệ'
    }),
  parentDepartment: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Parent Department ID không hợp lệ'
    }),
  location: Joi.object({
    building: Joi.string()
      .max(100)
      .trim()
      .optional()
      .messages({
        'string.max': 'Tên tòa nhà không được vượt quá 100 ký tự'
      }),
    floor: Joi.string()
      .max(10)
      .trim()
      .optional()
      .messages({
        'string.max': 'Tầng không được vượt quá 10 ký tự'
      }),
    room: Joi.string()
      .max(20)
      .trim()
      .optional()
      .messages({
        'string.max': 'Phòng không được vượt quá 20 ký tự'
      })
  }).optional(),
  contact: Joi.object({
    phone: Joi.string()
      .pattern(/^[0-9]{10,11}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Số điện thoại phải có 10-11 chữ số'
      }),
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .optional()
      .messages({
        'string.email': 'Email không hợp lệ'
      }),
    extension: Joi.string()
      .max(10)
      .trim()
      .optional()
      .messages({
        'string.max': 'Số nội bộ không được vượt quá 10 ký tự'
      })
  }).optional(),
  isActive: Joi.boolean().optional()
});

export const updateDepartmentSchema = departmentSchema.fork(['name', 'code'], (schema) => schema.optional());

// Department API validation schemas (sử dụng managerId và parentId thay vì manager và parentDepartment)
export const departmentApiSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.min': 'Tên phòng ban không được để trống',
      'string.max': 'Tên phòng ban không được vượt quá 100 ký tự',
      'any.required': 'Tên phòng ban là bắt buộc'
    }),
  code: Joi.string()
    .min(1)
    .max(20)
    .uppercase()
    .trim()
    .pattern(/^[A-Z0-9_]+$/)
    .required()
    .messages({
      'string.min': 'Mã phòng ban không được để trống',
      'string.max': 'Mã phòng ban không được vượt quá 20 ký tự',
      'string.pattern.base': 'Mã phòng ban chỉ được chứa chữ cái viết hoa, số và dấu gạch dưới',
      'any.required': 'Mã phòng ban là bắt buộc'
    }),
  description: Joi.string()
    .max(500)
    .trim()
    .allow('')
    .optional()
    .messages({
      'string.max': 'Mô tả không được vượt quá 500 ký tự'
    }),
  manager: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': 'Manager ID không hợp lệ'
    }),
  parent: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': 'Parent ID không hợp lệ'
    }),
  status: Joi.string()
    .valid('active', 'inactive')
    .optional()
    .messages({
      'any.only': 'Trạng thái phải là "active" hoặc "inactive"'
    }),
  isActive: Joi.boolean().optional()
});

export const updateDepartmentApiSchema = departmentApiSchema.fork(['name', 'code'], (schema) => schema.optional());

// Working Hours Request Validation Schemas
export const workingHoursRequestSchema = Joi.object({
  requestType: Joi.string()
    .valid('entry', 'exit', 'both')
    .required()
    .messages({
      'any.only': 'Loại yêu cầu phải là entry, exit hoặc both',
      'any.required': 'Loại yêu cầu là bắt buộc'
    }),
  
  plannedEntryTime: Joi.date()
    .greater('now')
    .when('requestType', {
      is: Joi.valid('entry', 'both'),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'date.greater': 'Thời gian vào phải lớn hơn thời gian hiện tại',
      'any.required': 'Thời gian vào là bắt buộc khi loại yêu cầu là entry hoặc both'
    }),
  
  plannedExitTime: Joi.date()
    .when('requestType', {
      is: 'both',
      then: Joi.date().greater(Joi.ref('plannedEntryTime')).required(),
      otherwise: Joi.optional()
    })
    .when('requestType', {
      is: 'exit',
      then: Joi.date().greater('now').required(),
      otherwise: Joi.optional()
    })
    .messages({
      'date.greater': 'Thời gian ra không hợp lệ (phải lớn hơn thời gian vào hoặc hiện tại)',
      'any.required': 'Thời gian ra là bắt buộc khi loại yêu cầu là exit hoặc both'
    }),
  
  licensePlate: Joi.string()
    .pattern(/^[0-9]{2}[A-Z]{1,2}-[0-9]{3,4}\.[0-9]{2}$|^[0-9]{2}[A-Z]{1,2}[0-9]{3,5}$/)
    .required()
    .messages({
      'string.pattern.base': 'Biển số xe không đúng định dạng (VD: 30A-123.45)',
      'any.required': 'Biển số xe là bắt buộc'
    }),
  
  reason: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': 'Lý do phải có ít nhất 10 ký tự',
      'string.max': 'Lý do không được vượt quá 500 ký tự',
      'any.required': 'Lý do yêu cầu là bắt buộc'
    }),
  
  // Cho phép admin tạo yêu cầu thay mặt user khác trong cùng department
  requestedBy: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'ID người yêu cầu không hợp lệ'
    }),
  
  metadata: Joi.object({
    emergencyContact: Joi.string().max(15),
    vehicleInfo: Joi.string().max(200)
  }).optional()
});

export const updateWorkingHoursRequestSchema = Joi.object({
  requestType: Joi.string()
    .valid('entry', 'exit', 'both')
    .optional()
    .messages({
      'any.only': 'Loại yêu cầu phải là entry, exit hoặc both'
    }),
  
  plannedEntryTime: Joi.date()
    .greater('now')
    .optional()
    .messages({
      'date.greater': 'Thời gian vào phải lớn hơn thời gian hiện tại'
    }),
  
  plannedExitTime: Joi.date()
    .optional()
    .messages({
      'date.greater': 'Thời gian ra phải lớn hơn thời gian vào'
    }),
  
  licensePlate: Joi.string()
    .pattern(/^[0-9]{2}[A-Z]{1,2}-[0-9]{3,4}\.[0-9]{2}$|^[0-9]{2}[A-Z]{1,2}[0-9]{3,5}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Biển số xe không đúng định dạng (VD: 30A-123.45)'
    }),
  
  reason: Joi.string()
    .min(10)
    .max(500)
    .optional()
    .messages({
      'string.min': 'Lý do phải có ít nhất 10 ký tự',
      'string.max': 'Lý do không được vượt quá 500 ký tự'
    }),
  
  metadata: Joi.object({
    emergencyContact: Joi.string().max(15),
    vehicleInfo: Joi.string().max(200)
  }).optional()
});

export const approvalRequestSchema = Joi.object({
  approvalNote: Joi.string()
    .max(300)
    .optional()
    .messages({
      'string.max': 'Ghi chú phê duyệt không được vượt quá 300 ký tự'
    })
});

export const workingHoursRequestParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID yêu cầu không hợp lệ',
      'any.required': 'ID yêu cầu là bắt buộc'
    })
});

export const workingHoursRequestQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'approved', 'rejected', 'expired', 'used').optional(),
  requestType: Joi.string().valid('entry', 'exit', 'both').optional(),
  licensePlate: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional(),
  requestedBy: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
});

// Video Stream validation schemas
export const videoStreamRequestSchema = Joi.object({
  quality: Joi.string()
    .valid('low', 'medium', 'high', 'ultra')
    .default('medium')
    .messages({
      'any.only': 'Chất lượng video phải là: low, medium, high, hoặc ultra'
    }),
  frameRate: Joi.number()
    .min(1)
    .max(60)
    .optional()
    .messages({
      'number.min': 'Frame rate phải lớn hơn 0',
      'number.max': 'Frame rate không được vượt quá 60'
    }),
  resolution: Joi.object({
    width: Joi.number().min(320).max(3840).optional(),
    height: Joi.number().min(240).max(2160).optional()
  }).optional()
});

export const cameraControlSchema = Joi.object({
  command: Joi.string()
    .valid('pan_left', 'pan_right', 'tilt_up', 'tilt_down', 'zoom_in', 'zoom_out', 'preset')
    .required()
    .messages({
      'any.only': 'Command phải là một trong: pan_left, pan_right, tilt_up, tilt_down, zoom_in, zoom_out, preset',
      'any.required': 'Command là bắt buộc'
    }),
  value: Joi.number()
    .min(-100)
    .max(100)
    .optional()
    .messages({
      'number.min': 'Giá trị phải từ -100 đến 100',
      'number.max': 'Giá trị phải từ -100 đến 100'
    })
});

export const streamSettingsSchema = Joi.object({
  quality: Joi.string()
    .valid('low', 'medium', 'high', 'ultra')
    .optional(),
  streamEnabled: Joi.boolean().optional(),
  frameRate: Joi.number()
    .min(1)
    .max(60)
    .optional(),
  resolution: Joi.object({
    width: Joi.number().min(320).max(3840).optional(),
    height: Joi.number().min(240).max(2160).optional()
  }).optional(),
  bitrate: Joi.number()
    .min(100)
    .max(10000)
    .optional(),
  maxClients: Joi.number()
    .min(1)
    .max(50)
    .optional()
});

// Middleware validation functions
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Query parameters không hợp lệ',
        errors
      });
    }
    
    next();
  };
};

const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Route parameters không hợp lệ',
        errors
      });
    }
    
    next();
  };
};

// Export validation middleware
export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateVehicle = validate(vehicleSchema);
export const validateUpdateVehicle = validate(updateVehicleSchema);
export const validateAccessLog = validate(accessLogSchema);
export const validateVerifyAccessLog = validate(verifyAccessLogSchema);
export const validateUpdateAccessLogInfo = validate(updateAccessLogInfoSchema);
export const validateUpdateUser = validate(updateUserSchema);
export const validateChangePassword = validate(changePasswordSchema);
export const validateCamera = validate(cameraSchema);
export const validateUpdateCamera = validate(updateCameraSchema);
export const validateWorkingHours = validate(workingHoursSchema);
export const validateUpdateWorkingHours = validate(updateWorkingHoursSchema);
export const validateCheckWorkingTime = validateQuery(checkWorkingTimeSchema);
export const validateWorkingHoursParams = validateParams(workingHoursParamsSchema);
export const validateWorkingHoursQuery = validateQuery(workingHoursQuerySchema);
export const validateDepartment = validate(departmentApiSchema);
export const validateUpdateDepartment = validate(updateDepartmentApiSchema);
export const validateDepartmentOriginal = validate(departmentSchema);
export const validateUpdateDepartmentOriginal = validate(updateDepartmentSchema);
export const validateWorkingHoursRequest = validate(workingHoursRequestSchema);
export const validateUpdateWorkingHoursRequest = validate(updateWorkingHoursRequestSchema);
export const validateApprovalRequest = validate(approvalRequestSchema);
export const validateWorkingHoursRequestParams = validateParams(workingHoursRequestParamsSchema);
export const validateWorkingHoursRequestQuery = validateQuery(workingHoursRequestQuerySchema);
export const validateVideoStreamRequest = validate(videoStreamRequestSchema);
export const validateCameraControl = validate(cameraControlSchema);
export const validateStreamSettings = validate(streamSettingsSchema);
