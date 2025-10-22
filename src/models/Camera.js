import mongoose from 'mongoose';
import { encryptPassword } from '../utils/encryption.js';

const cameraSchema = new mongoose.Schema({
  // Thông tin cơ bản
  cameraId: {
    type: String,
    required: [true, 'ID camera là bắt buộc'],
    unique: true,
    trim: true,
    maxlength: [50, 'ID camera không được vượt quá 50 ký tự']
  },
  name: {
    type: String,
    required: [true, 'Tên camera là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên camera không được vượt quá 100 ký tự']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Mô tả không được vượt quá 500 ký tự']
  },
  
  // Thông tin vị trí
  location: {
    gateId: {
      type: String,
      required: [true, 'ID cổng là bắt buộc'],
      trim: true
    },
    gateName: {
      type: String,
      trim: true,
      maxlength: [100, 'Tên cổng không được vượt quá 100 ký tự']
    },
    position: {
      type: String,
      enum: {
        values: ['entry', 'exit', 'both'],
        message: '{VALUE} không phải là vị trí hợp lệ'
      },
      default: 'both'
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Vĩ độ phải từ -90 đến 90'],
        max: [90, 'Vĩ độ phải từ -90 đến 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Kinh độ phải từ -180 đến 180'],
        max: [180, 'Kinh độ phải từ -180 đến 180']
      }
    }
  },

  // Thông tin kỹ thuật
  technical: {
    ipAddress: {
      type: String,
      trim: true,
      match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, 'Địa chỉ IP không hợp lệ']
    },
    port: {
      type: Number,
      min: [1, 'Port phải lớn hơn 0'],
      max: [65535, 'Port phải nhỏ hơn 65536']
    },
    protocol: {
      type: String,
      enum: {
        values: ['http', 'https', 'rtsp', 'rtmp', 'onvif'],
        message: '{VALUE} không phải là protocol hợp lệ'
      },
      default: 'http'
    },
    username: {
      type: String,
      trim: true,
      maxlength: [50, 'Username không được vượt quá 50 ký tự']
    },
    password: {
      type: String,
      maxlength: [100, 'Password không được vượt quá 100 ký tự']
    },
    streamUrl: {
      type: String,
      trim: true,
      maxlength: [500, 'Stream URL không được vượt quá 500 ký tự']
    },
    resolution: {
      width: {
        type: Number,
        min: [1, 'Chiều rộng phải lớn hơn 0']
      },
      height: {
        type: Number,
        min: [1, 'Chiều cao phải lớn hơn 0']
      }
    },
    fps: {
      type: Number,
      min: [1, 'FPS phải lớn hơn 0'],
      max: [120, 'FPS không được vượt quá 120']
    }
  },

  // Cấu hình streaming
  streaming: {
    enabled: {
      type: Boolean,
      default: true
    },
    quality: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'ultra'],
        message: '{VALUE} không phải là chất lượng hợp lệ'
      },
      default: 'medium'
    },
    frameRate: {
      type: Number,
      min: [1, 'Frame rate phải lớn hơn 0'],
      max: [60, 'Frame rate không được vượt quá 60'],
      default: 15
    },
    bitrate: {
      type: Number,
      min: [100, 'Bitrate tối thiểu 100 kbps'],
      max: [10000, 'Bitrate tối đa 10000 kbps'],
      default: 1000
    },
    maxClients: {
      type: Number,
      min: [1, 'Số client tối thiểu là 1'],
      max: [50, 'Số client tối đa là 50'],
      default: 10
    },
    isStreaming: {
      type: Boolean,
      default: false
    },
    lastStreamStarted: {
      type: Date
    },
    lastStreamStopped: {
      type: Date
    },
    currentViewers: {
      type: Number,
      default: 0,
      min: [0, 'Số người xem không thể âm']
    }
  },

  // Cấu hình nhận diện
  recognition: {
    enabled: {
      type: Boolean,
      default: true
    },
    confidence: {
      threshold: {
        type: Number,
        min: [0, 'Ngưỡng confidence phải từ 0 đến 1'],
        max: [1, 'Ngưỡng confidence phải từ 0 đến 1'],
        default: 0.7
      },
      autoApprove: {
        type: Number,
        min: [0, 'Ngưỡng auto-approve phải từ 0 đến 1'],
        max: [1, 'Ngưỡng auto-approve phải từ 0 đến 1'],
        default: 0.9
      }
    },
    roi: { // Region of Interest
      x: {
        type: Number,
        min: [0, 'Tọa độ X phải >= 0'],
        default: 0
      },
      y: {
        type: Number,
        min: [0, 'Tọa độ Y phải >= 0'],
        default: 0
      },
      width: {
        type: Number,
        min: [1, 'Chiều rộng ROI phải > 0']
      },
      height: {
        type: Number,
        min: [1, 'Chiều cao ROI phải > 0']
      }
    },
    processingInterval: {
      type: Number,
      min: [100, 'Khoảng thời gian xử lý tối thiểu 100ms'],
      default: 1000 // milliseconds
    }
  },

  // Trạng thái hoạt động
  status: {
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true
    },
    lastPing: {
      type: Date
    },
    connectionStatus: {
      type: String,
      enum: {
        values: ['connected', 'disconnected', 'error', 'maintenance'],
        message: '{VALUE} không phải là trạng thái kết nối hợp lệ'
      },
      default: 'disconnected'
    },
    lastError: {
      message: String,
      timestamp: Date,
      code: String
    }
  },

  // Thống kê
  statistics: {
    totalDetections: {
      type: Number,
      default: 0,
      min: [0, 'Tổng số phát hiện phải >= 0']
    },
    successfulDetections: {
      type: Number,
      default: 0,
      min: [0, 'Số phát hiện thành công phải >= 0']
    },
    lastDetection: {
      type: Date
    },
    uptime: {
      type: Number, // Thời gian hoạt động tính bằng giờ
      default: 0,
      min: [0, 'Uptime phải >= 0']
    }
  },

  // Cấu hình bảo trì
  maintenance: {
    lastMaintenance: {
      type: Date
    },
    nextMaintenance: {
      type: Date
    },
    maintenanceInterval: {
      type: Number, // Số ngày giữa các lần bảo trì
      default: 30,
      min: [1, 'Khoảng thời gian bảo trì tối thiểu 1 ngày']
    },
    notes: [{
      message: {
        type: String,
        required: true,
        maxlength: [500, 'Ghi chú không được vượt quá 500 ký tự']
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Người quản lý
  managedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Thông tin cài đặt
  installationDate: {
    type: Date,
    default: Date.now
  },
  warrantyExpiry: {
    type: Date
  },
  manufacturer: {
    type: String,
    trim: true,
    maxlength: [100, 'Nhà sản xuất không được vượt quá 100 ký tự']
  },
  model: {
    type: String,
    trim: true,
    maxlength: [100, 'Model không được vượt quá 100 ký tự']
  },
  serialNumber: {
    type: String,
    trim: true,
    maxlength: [100, 'Số serial không được vượt quá 100 ký tự']
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Ẩn thông tin nhạy cảm
      if (ret.technical && ret.technical.password) {
        delete ret.technical.password;
      }
      return ret;
    }
  }
});

// Indexes cho tìm kiếm hiệu quả
cameraSchema.index({ cameraId: 1 });
cameraSchema.index({ 'location.gateId': 1 });
cameraSchema.index({ 'location.position': 1 });
cameraSchema.index({ 'status.isActive': 1 });
cameraSchema.index({ 'status.isOnline': 1 });
cameraSchema.index({ 'status.connectionStatus': 1 });
cameraSchema.index({ 'technical.ipAddress': 1 });
cameraSchema.index({ managedBy: 1 });
cameraSchema.index({ createdAt: -1 });

// Compound indexes
cameraSchema.index({ 'location.gateId': 1, 'location.position': 1 });
cameraSchema.index({ 'status.isActive': 1, 'status.isOnline': 1 });

// Virtual fields
cameraSchema.virtual('isWarrantyValid').get(function() {
  if (!this.warrantyExpiry) return false;
  return this.warrantyExpiry > new Date();
});

cameraSchema.virtual('needsMaintenance').get(function() {
  if (!this.maintenance.nextMaintenance) return false;
  return this.maintenance.nextMaintenance <= new Date();
});

cameraSchema.virtual('detectionSuccessRate').get(function() {
  if (this.statistics.totalDetections === 0) return 0;
  return (this.statistics.successfulDetections / this.statistics.totalDetections * 100).toFixed(2);
});

// Static methods
cameraSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, 'status.isActive': true })
    .populate('managedBy', 'name username');
};

cameraSchema.statics.findOnline = function(filter = {}) {
  return this.find({ 
    ...filter, 
    'status.isActive': true, 
    'status.isOnline': true 
  }).populate('managedBy', 'name username');
};

cameraSchema.statics.findByGate = function(gateId) {
  return this.find({ 
    'location.gateId': gateId, 
    'status.isActive': true 
  }).populate('managedBy', 'name username');
};

cameraSchema.statics.findNeedingMaintenance = function() {
  const now = new Date();
  return this.find({
    'status.isActive': true,
    $or: [
      { 'maintenance.nextMaintenance': { $lte: now } },
      { 'maintenance.nextMaintenance': { $exists: false } }
    ]
  }).populate('managedBy', 'name username');
};

cameraSchema.statics.getStatistics = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalCameras: { $sum: 1 },
        activeCameras: {
          $sum: { $cond: [{ $eq: ['$status.isActive', true] }, 1, 0] }
        },
        onlineCameras: {
          $sum: { $cond: [{ $and: [
            { $eq: ['$status.isActive', true] },
            { $eq: ['$status.isOnline', true] }
          ]}, 1, 0] }
        },
        totalDetections: { $sum: '$statistics.totalDetections' },
        successfulDetections: { $sum: '$statistics.successfulDetections' },
        averageUptime: { $avg: '$statistics.uptime' }
      }
    }
  ]);
};

// Instance methods
cameraSchema.methods.updateStatus = function(status, errorInfo = null) {
  this.status.isOnline = status === 'connected';
  this.status.connectionStatus = status;
  this.status.lastPing = new Date();
  
  if (errorInfo) {
    this.status.lastError = {
      message: errorInfo.message,
      timestamp: new Date(),
      code: errorInfo.code
    };
  }
  
  return this.save();
};

cameraSchema.methods.incrementDetection = function(successful = true) {
  this.statistics.totalDetections += 1;
  if (successful) {
    this.statistics.successfulDetections += 1;
  }
  this.statistics.lastDetection = new Date();
  return this.save();
};

cameraSchema.methods.addMaintenanceNote = function(message, userId) {
  this.maintenance.notes.push({
    message,
    createdBy: userId,
    createdAt: new Date()
  });
  return this.save();
};

cameraSchema.methods.scheduleNextMaintenance = function() {
  const now = new Date();
  const nextMaintenance = new Date(now);
  nextMaintenance.setDate(now.getDate() + this.maintenance.maintenanceInterval);
  
  this.maintenance.lastMaintenance = now;
  this.maintenance.nextMaintenance = nextMaintenance;
  
  return this.save();
};

// Middleware
cameraSchema.pre('save', async function(next) {
  try {
    // Hash mật khẩu camera nếu có thay đổi
    if (this.isModified('technical.password') && this.technical.password) {
      this.technical.password = await encryptPassword(this.technical.password);
    }
    
    // Tự động tính toán nextMaintenance nếu chưa có
    if (this.isNew && !this.maintenance.nextMaintenance) {
      const installDate = this.installationDate || new Date();
      this.maintenance.nextMaintenance = new Date(
        installDate.getTime() + (this.maintenance.maintenanceInterval * 24 * 60 * 60 * 1000)
      );
    }
    
    // Validate ROI không vượt quá resolution
    if (this.recognition.roi && this.technical.resolution) {
      const roi = this.recognition.roi;
      const res = this.technical.resolution;
      
      if (roi.x + roi.width > res.width || roi.y + roi.height > res.height) {
        return next(new Error('ROI vượt quá kích thước resolution'));
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model('Camera', cameraSchema);
