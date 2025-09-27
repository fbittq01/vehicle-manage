import mongoose from 'mongoose';

const accessLogSchema = new mongoose.Schema({
  licensePlate: {
    type: String,
    required: [true, 'Biển số xe là bắt buộc'],
    uppercase: true,
    trim: true,
    index: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    index: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  action: {
    type: String,
    enum: {
      values: ['entry', 'exit'],
      message: '{VALUE} không phải là hành động hợp lệ'
    },
    required: [true, 'Hành động là bắt buộc'],
    index: true
  },
  gateId: {
    type: String,
    required: [true, 'ID cổng là bắt buộc'],
    trim: true,
    index: true
  },
  gateName: {
    type: String,
    trim: true,
    maxlength: [100, 'Tên cổng không được vượt quá 100 ký tự']
  },
  // Thông tin nhận diện từ AI
  recognitionData: {
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: [true, 'Độ tin cậy là bắt buộc']
    },
    processedImage: {
      type: String, // Base64 hoặc URL của ảnh đã xử lý
      required: false
    },
    originalImage: {
      type: String, // Base64 hoặc URL của ảnh gốc
      required: false
    },
    videoUrl: {
      type: String, // URL của video 10 giây
      required: false,
      trim: true,
      maxlength: [500, 'URL video không được vượt quá 500 ký tự']
    },
    boundingBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    },
    processingTime: {
      type: Number, // Thời gian xử lý tính bằng milliseconds
      min: 0
    }
  },
  // Trạng thái xác minh
  verificationStatus: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'auto_approved'],
      message: '{VALUE} không phải là trạng thái hợp lệ'
    },
    default: 'pending',
    index: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationTime: {
    type: Date
  },
  verificationNote: {
    type: String,
    trim: true,
    maxlength: [500, 'Ghi chú xác minh không được vượt quá 500 ký tự']
  },
  // Thông tin bổ sung
  isVehicleRegistered: {
    type: Boolean,
    default: false,
    index: true
  },
  isOwnerActive: {
    type: Boolean,
    default: false
  },
  accessDeniedReason: {
    type: String,
    trim: true,
    maxlength: [200, 'Lý do từ chối không được vượt quá 200 ký tự']
  },
  // Metadata
  deviceInfo: {
    cameraId: String,
    deviceName: String,
    ipAddress: String
  },
  camera: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camera',
    index: true
  },
  weather: {
    condition: String,
    temperature: Number,
    humidity: Number
  },
  duration: {
    type: Number, // Thời gian lưu trú (phút) - chỉ có khi exit
    min: 0
  },
  
  // Metadata bổ sung
  metadata: {
    workingHoursRequest: {
      requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkingHoursRequest'
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      approvedAt: Date
    }
  },
  
  // Thông tin khách (cho xe chưa đăng ký)
  guestInfo: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Tên khách không được vượt quá 100 ký tự']
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Số điện thoại không được vượt quá 20 ký tự']
    },
    idCard: {
      type: String,
      trim: true,
      maxlength: [20, 'Số CMND/CCCD không được vượt quá 20 ký tự']
    },
    hometown: {
      type: String,
      trim: true,
      maxlength: [200, 'Quê quán không được vượt quá 200 ký tự']
    },
    visitPurpose: {
      type: String,
      trim: true,
      maxlength: [300, 'Mục đích thăm viếng không được vượt quá 300 ký tự']
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: [100, 'Người liên hệ không được vượt quá 100 ký tự']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Ghi chú không được vượt quá 500 ký tự']
    }
  }
}, {
  timestamps: true
});

// Compound indexes cho queries phức tạp
accessLogSchema.index({ licensePlate: 1, createdAt: -1 });
accessLogSchema.index({ vehicle: 1, action: 1, createdAt: -1 });
accessLogSchema.index({ owner: 1, createdAt: -1 });
accessLogSchema.index({ gateId: 1, createdAt: -1 });
accessLogSchema.index({ verificationStatus: 1, createdAt: -1 });
accessLogSchema.index({ action: 1, createdAt: -1 });
accessLogSchema.index({ createdAt: -1 }); // Cho sorting theo thời gian

// Index cho tìm kiếm theo ngày
accessLogSchema.index({
  createdAt: 1,
  action: 1,
  verificationStatus: 1
});

// Virtual field để tính duration khi có entry và exit
accessLogSchema.virtual('stayDuration').get(function() {
  if (this.action === 'exit' && this.duration) {
    return this.duration;
  }
  return null;
});

// Static method tìm logs theo khoảng thời gian
accessLogSchema.statics.findByDateRange = function(startDate, endDate, additionalFilter = {}) {
  return this.find({
    ...additionalFilter,
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('vehicle').populate('owner', 'name username').populate('verifiedBy', 'name');
};

// Static method tìm logs theo biển số
accessLogSchema.statics.findByLicensePlate = function(licensePlate, limit = 50) {
  return this.find({ licensePlate: licensePlate.toUpperCase() })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('vehicle')
    .populate('owner', 'name username')
    .populate('verifiedBy', 'name');
};

// Static method tìm logs theo thông tin khách
accessLogSchema.statics.findByGuestInfo = function(searchQuery, limit = 50) {
  const query = {
    isVehicleRegistered: false,
    $or: [
      { 'guestInfo.name': { $regex: searchQuery, $options: 'i' } },
      { 'guestInfo.phone': { $regex: searchQuery, $options: 'i' } },
      { 'guestInfo.idCard': { $regex: searchQuery, $options: 'i' } },
      { 'guestInfo.hometown': { $regex: searchQuery, $options: 'i' } }
    ]
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('verifiedBy', 'name username');
};

// Static method lấy thống kê theo ngày
accessLogSchema.statics.getDailyStats = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        uniqueVehicles: { $addToSet: '$licensePlate' }
      }
    },
    {
      $project: {
        action: '$_id',
        count: 1,
        uniqueVehicleCount: { $size: '$uniqueVehicles' }
      }
    }
  ]);
};

// Static method tìm xe đang trong khuôn viên
accessLogSchema.statics.findVehiclesInside = async function() {
  const pipeline = [
    { $sort: { licensePlate: 1, createdAt: -1 } },
    {
      $group: {
        _id: '$licensePlate',
        lastAction: { $first: '$action' },
        lastEntry: { $first: '$$ROOT' }
      }
    },
    { $match: { lastAction: 'entry' } },
    { $replaceRoot: { newRoot: '$lastEntry' } }
  ];

  return this.aggregate(pipeline);
};

// Method để auto-approve dựa trên confidence
accessLogSchema.methods.autoApprove = function(threshold = 0.9) {
  if (this.recognitionData.confidence >= threshold && this.isVehicleRegistered) {
    this.verificationStatus = 'auto_approved';
    this.verificationTime = new Date();
    this.verificationNote = `Auto-approved với confidence ${this.recognitionData.confidence}`;
  }
};

// Method tính duration cho exit log
accessLogSchema.methods.calculateDuration = async function() {
  if (this.action !== 'exit') return;

  const entryLog = await this.constructor.findOne({
    licensePlate: this.licensePlate,
    action: 'entry',
    createdAt: { $lt: this.createdAt }
  }).sort({ createdAt: -1 });

  if (entryLog) {
    this.duration = Math.round((this.createdAt - entryLog.createdAt) / (1000 * 60)); // minutes
  }
};

export default mongoose.model('AccessLog', accessLogSchema);
