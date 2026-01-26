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
  
  // Thời gian dự kiến VÀO
  plannedEntryTime: {
    type: Date,
    validate: {
      validator: function(entryTime) {
        // entry và both phải có plannedEntryTime
        if (this.requestType === 'entry' || this.requestType === 'both') {
          return !!entryTime;
        }
        return true;
      },
      message: 'Thời gian vào là bắt buộc khi loại yêu cầu là entry hoặc both'
    },
    index: true
  },
  
  // Thời gian dự kiến RA
  plannedExitTime: {
    type: Date,
    validate: {
      validator: function(exitTime) {
        // exit và both phải có plannedExitTime
        if (this.requestType === 'exit' || this.requestType === 'both') {
          return !!exitTime;
        }
        // Nếu có cả entry và exit, exit phải > entry
        if (exitTime && this.plannedEntryTime) {
          return exitTime > this.plannedEntryTime;
        }
        return true;
      },
      message: 'Thời gian ra không hợp lệ'
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
  
  // Thời gian hiệu lực (được tính dựa trên plannedEntryTime hoặc plannedExitTime)
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
workingHoursRequestSchema.index({ plannedEntryTime: 1, status: 1 });
workingHoursRequestSchema.index({ plannedExitTime: 1, status: 1 });
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
  
  // Với requestType = 'both', kiểm tra action này đã được sử dụng chưa
  if (this.requestType === 'both' && this.relatedAccessLogs.length > 0) {
    // Cần populate relatedAccessLogs để kiểm tra action
    // Nếu chưa populate, cho phép sử dụng (sẽ check ở findApplicableRequest)
    const usedActions = new Set();
    for (const log of this.relatedAccessLogs) {
      if (log.action) {
        usedActions.add(log.action);
      }
    }
    
    // Nếu action hiện tại đã được sử dụng rồi, không cho phép
    if (usedActions.has(accessLog.action)) {
      return false;
    }
  }
  
  // Kiểm tra thời gian (trong vòng ±30 phút so với thời gian dự kiến)
  const tolerance = 30 * 60 * 1000; // 30 phút
  const logTime = new Date(accessLog.createdAt);
  
  // Xác định thời gian cần check dựa vào action
  // entry -> check plannedEntryTime, exit -> check plannedExitTime
  const plannedTime = accessLog.action === 'entry' 
    ? this.plannedEntryTime 
    : this.plannedExitTime;
  
  if (!plannedTime) return false;
  
  const timeDiff = Math.abs(logTime - new Date(plannedTime));
  return timeDiff <= tolerance;
};

// Method đánh dấu yêu cầu đã được sử dụng
workingHoursRequestSchema.methods.markAsUsed = function(accessLogId, action) {
  // Thêm access log vào danh sách
  this.relatedAccessLogs.push(accessLogId);
  
  // Quyết định khi nào đánh dấu 'used' dựa vào requestType
  if (this.requestType === 'both') {
    // Với 'both', chỉ đánh dấu 'used' khi đã có 2 access logs (vào và ra)
    if (this.relatedAccessLogs.length >= 2) {
      this.status = 'used';
    }
  } else {
    // Với 'entry' hoặc 'exit', đánh dấu 'used' ngay
    this.status = 'used';
  }
  
  return this.save();
};

// Static method tìm yêu cầu có thể áp dụng cho access log
workingHoursRequestSchema.statics.findApplicableRequest = async function(accessLog) {
  const tolerance = 30 * 60 * 1000; // 30 phút
  const logTime = new Date(accessLog.createdAt);
  const minTime = new Date(logTime.getTime() - tolerance);
  const maxTime = new Date(logTime.getTime() + tolerance);
  
  // Xác định trường thời gian cần check dựa vào action của access log
  // entry -> so sánh với plannedEntryTime
  // exit -> so sánh với plannedExitTime
  const timeField = accessLog.action === 'entry' 
    ? 'plannedEntryTime' 
    : 'plannedExitTime';
  
  const request = await this.findOne({
    licensePlate: accessLog.licensePlate,
    status: 'approved',
    // Yêu cầu phải phù hợp với action (entry/exit) hoặc là 'both'
    requestType: { $in: [accessLog.action, 'both'] },
    // Thời gian tương ứng phải nằm trong khoảng tolerance (logTime ± 30 phút)
    [timeField]: { $gte: minTime, $lte: maxTime },
    // Còn hiệu lực
    $or: [
      { validUntil: { $gte: new Date() } },
      { validUntil: null }
    ]
  })
  .populate('requestedBy', 'name username employeeId department')
  .populate('relatedAccessLogs', 'action createdAt');
  
  // Nếu tìm thấy request và là type 'both', kiểm tra action đã được sử dụng chưa
  if (request && request.requestType === 'both' && request.relatedAccessLogs.length > 0) {
    const usedActions = new Set(
      request.relatedAccessLogs.map(log => log.action)
    );
    
    // Nếu action hiện tại đã được sử dụng, return null
    if (usedActions.has(accessLog.action)) {
      return null;
    }
  }
  
  return request;
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
    // Xác định thời gian hết hạn dựa trên loại yêu cầu
    // Ưu tiên plannedExitTime nếu có, vì đó là thời điểm cuối cùng cần xét
    if (this.plannedExitTime) {
      this.validUntil = new Date(this.plannedExitTime);
    } else if (this.plannedEntryTime) {
      this.validUntil = new Date(this.plannedEntryTime);
    }
    this.approvedAt = new Date();
  }
  
  next();
});

export default mongoose.model('WorkingHoursRequest', workingHoursRequestSchema);
