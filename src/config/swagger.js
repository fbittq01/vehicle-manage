import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hệ thống Quản lý Phương tiện API',
      version: '1.0.0',
      description: 'API cho hệ thống quản lý phương tiện ra vào cổng thông qua biển số xe',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? process.env.BASE_URL || 'https://your-vercel-domain.vercel.app'
          : 'http://localhost:8000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            username: {
              type: 'string',
              example: 'admin'
            },
            email: {
              type: 'string',
              example: 'admin@example.com'
            },
            role: {
              type: 'string',
              enum: ['admin', 'user', 'security'],
              example: 'admin'
            },
            departmentId: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Vehicle: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            licensePlate: {
              type: 'string',
              example: '29A-12345'
            },
            ownerName: {
              type: 'string',
              example: 'Nguyễn Văn A'
            },
            ownerPhone: {
              type: 'string',
              example: '0123456789'
            },
            vehicleType: {
              type: 'string',
              example: 'car'
            },
            departmentId: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'blocked'],
              example: 'active'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Department: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Phòng Kỹ thuật'
            },
            code: {
              type: 'string',
              example: 'KT001'
            },
            description: {
              type: 'string',
              example: 'Phòng ban kỹ thuật'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Camera: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Camera Cổng chính'
            },
            location: {
              type: 'string',
              example: 'Cổng chính - Lối vào'
            },
            ipAddress: {
              type: 'string',
              example: '192.168.1.100'
            },
            port: {
              type: 'number',
              example: 8080
            },
            type: {
              type: 'string',
              enum: ['entry', 'exit'],
              example: 'entry'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'maintenance'],
              example: 'active'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        AccessLog: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            licensePlate: {
              type: 'string',
              example: '29A-12345'
            },
            vehicleId: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            cameraId: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            type: {
              type: 'string',
              enum: ['entry', 'exit'],
              example: 'entry'
            },
            status: {
              type: 'string',
              enum: ['authorized', 'unauthorized', 'pending'],
              example: 'authorized'
            },
            image: {
              type: 'string',
              example: 'uploads/access-logs/image.jpg'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        WorkingHours: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            date: {
              type: 'string',
              format: 'date',
              example: '2025-01-15'
            },
            checkIn: {
              type: 'string',
              format: 'time',
              example: '08:00'
            },
            checkOut: {
              type: 'string',
              format: 'time',
              example: '17:30'
            },
            status: {
              type: 'string',
              enum: ['present', 'absent', 'late', 'early_leave'],
              example: 'present'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        WorkingHoursRequest: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            requestType: {
              type: 'string',
              enum: ['leave', 'overtime', 'adjustment'],
              example: 'leave'
            },
            startDate: {
              type: 'string',
              format: 'date',
              example: '2025-01-15'
            },
            endDate: {
              type: 'string',
              format: 'date',
              example: '2025-01-16'
            },
            reason: {
              type: 'string',
              example: 'Nghỉ phép cá nhân'
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected'],
              example: 'pending'
            },
            approvedBy: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              example: 'Detailed error information'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation successful'
            },
            data: {
              type: 'object'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'] // Đường dẫn tới các file routes
};

const specs = swaggerJSDoc(options);

export { swaggerUi, specs };
