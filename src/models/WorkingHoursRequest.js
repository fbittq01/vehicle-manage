import mongoose from 'mongoose';

const workingHoursRequestSchema = new mongoose.Schema({
  // Người yêu cầu
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Người yêu cầu là bắt buộc'],
    index: true
  },
  
  // Loại yêu cầu
  requestType: {
    type: String,
    enum: {
      values: ['entry', 'exit', 'both'],
      message: '{VALUE} không phải là loại yêu cầu hợp lệ'
    },
    required: [true, 'Loại yêu cầu là bắt buộc']
  },
  
  // Thời gian dự kiến ra/vào
  plannedDateTime: {
    type: Date,
    required: [true, 'Thời gian dự kiến là bắt buộc'],
    index: true
  },
  
  // Thời gian dự kiến kết thúc (đối với trường hợp both)
  plannedEndDateTime: {
    type: Date,
    validate: {
      validator: function(endDate) {
        // Chỉ validate khi requestType là 'both'
        if (this.requestType === 'both') {
          return endDate && endDate > this.plannedDateTime;
        }
        return true;
      },
      message: 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu'
    }
  },
  
  // Biển số xe
  licensePlate: {
    type: String,
    required: [true, 'Biển số xe là bắt buộc'],
    uppercase: true,
    trim: true,
    index: true
  },
  
  // Lý do yêu cầu
  reason: {
    type: String,
    required: [true, 'Lý do yêu cầu là bắt buộc'],
    trim: true,
    minlength: [10, 'Lý do phải có ít nhất 10 ký tự'],
    maxlength: [500, 'Lý do không được vượt quá 500 ký tự']
  },
  
  // Trạng thái yêu cầu
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'expired', 'used'],
      message: '{VALUE} không phải là trạng thái hợp lệ'
    },
    default: 'pending',
    index: true
  },
  
  // Người phê duyệt
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Thời gian phê duyệt
  approvedAt: {
    type: Date
  },
  
  // Ghi chú từ người phê duyệt
  approvalNote: {
    type: String,
    trim: true,
    maxlength: [300, 'Ghi chú phê duyệt không được vượt quá 300 ký tự']
  },
  
  // Access log liên quan (khi đã sử dụng)
  relatedAccessLogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccessLog'
  }],
  
  // Thời gian hiệu lực (mặc định là 1 ngày từ thời điểm được phê duyệt)
  validUntil: {
    type: Date
  },
  
  // Có tự động expire không
  autoExpire: {
    type: Boolean,
    default: true
  },
  
  // Metadata cho việc tracking
  metadata: {
    department: String,
    phoneNumber: String,
    emergencyContact: String,
    vehicleInfo: String
  }
}, {
  timestamps: true
});

// Indexes để tối ưu query
workingHoursRequestSchema.index({ requestedBy: 1, status: 1 });
workingHoursRequestSchema.index({ plannedDateTime: 1, status: 1 });
workingHoursRequestSchema.index({ licensePlate: 1, status: 1 });
workingHoursRequestSchema.index({ createdAt: -1 });

// Virtual để tính thời gian còn lại
workingHoursRequestSchema.virtual('timeRemaining').get(function() {
  if (this.status !== 'approved' || !this.validUntil) return null;
  
  const now = new Date();
  const remaining = this.validUntil - now;
  
  if (remaining <= 0) return 0;
  
  return Math.floor(remaining / (1000 * 60)); // Trả về phút
});

// Method kiểm tra yêu cầu có còn hiệu lực không
workingHoursRequestSchema.methods.isValid = function() {
  if (this.status !== 'approved') return false;
  if (!this.validUntil) return true; // Không có thời hạn
  
  return new Date() <= this.validUntil;
};

// Method kiểm tra yêu cầu có thể sử dụng cho access log này không
workingHoursRequestSchema.methods.canApplyToAccessLog = function(accessLog) {
  if (!this.isValid()) return false;
  if (this.status === 'used') return false;
  
  // Kiểm tra biển số
  if (this.licensePlate !== accessLog.licensePlate) return false;
  
  // Kiểm tra loại action
  if (this.requestType !== 'both' && this.requestType !== accessLog.action) return false;
  
  // Kiểm tra thời gian (trong vòng ±30 phút so với thời gian dự kiến)
  const tolerance = 30 * 60 * 1000; // 30 phút
  const logTime = new Date(accessLog.createdAt);
  const plannedTime = new Date(this.plannedDateTime);
  
  const timeDiff = Math.abs(logTime - plannedTime);
  
  if (this.requestType === 'both' && this.plannedEndDateTime) {
    const plannedEndTime = new Date(this.plannedEndDateTime);
    const endTimeDiff = Math.abs(logTime - plannedEndTime);
    return timeDiff <= tolerance || endTimeDiff <= tolerance;
  }
  
  return timeDiff <= tolerance;
};

// Method đánh dấu yêu cầu đã được sử dụng
workingHoursRequestSchema.methods.markAsUsed = function(accessLogId) {
  this.status = 'used';
  this.relatedAccessLogs.push(accessLogId);
  return this.save();
};

// Static method tìm yêu cầu có thể áp dụng cho access log
workingHoursRequestSchema.statics.findApplicableRequest = function(accessLog) {
  const tolerance = 60 * 60 * 1000; // 30 phút
  const logTime = new Date(accessLog.createdAt);
  const startTime = new Date(logTime.getTime() - tolerance);
  const endTime = new Date(logTime.getTime() + tolerance);
  
  return this.findOne({
    licensePlate: accessLog.licensePlate,
    status: 'approved',
    $or: [
      {
        requestType: accessLog.action,
        plannedDateTime: { $gte: startTime, $lte: endTime }
      },
      {
        requestType: 'both',
        $or: [
          { plannedDateTime: { $gte: startTime, $lte: endTime } },
          { plannedEndDateTime: { $gte: startTime, $lte: endTime } }
        ]
      }
    ],
    $or: [
      { validUntil: { $gte: new Date() } },
      { validUntil: null }
    ]
  }).populate('requestedBy', 'name username employeeId department');
};

// Static method auto-expire các yêu cầu đã hết hạn
workingHoursRequestSchema.statics.autoExpireRequests = function() {
  return this.updateMany({
    status: 'approved',
    autoExpire: true,
    validUntil: { $lt: new Date() }
  }, {
    status: 'expired'
  });
};

// Pre-save middleware
workingHoursRequestSchema.pre('save', function(next) {
  // Tự động set validUntil khi được approve
  if (this.isModified('status') && this.status === 'approved' && !this.validUntil) {
    // Hiệu lực trong 24 giờ từ thời điểm approve
    this.validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    this.approvedAt = new Date();
  }
  
  next();
});

export default mongoose.model('WorkingHoursRequest', workingHoursRequestSchema);
