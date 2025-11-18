import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  // Thông tin người nhận
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID người nhận là bắt buộc'],
    index: true
  },
  
  // Loại thông báo
  type: {
    type: String,
    enum: {
      values: [
        'working_hours_request',
        'working_hours_request_update', 
        'access_log_verification',
        'access_log_verified',
        'system_maintenance',
        'emergency_alert'
      ],
      message: '{VALUE} không phải là loại thông báo hợp lệ'
    },
    required: [true, 'Loại thông báo là bắt buộc'],
    index: true
  },
  
  // Tiêu đề thông báo
  title: {
    type: String,
    required: [true, 'Tiêu đề thông báo là bắt buộc'],
    trim: true,
    maxlength: [200, 'Tiêu đề không được vượt quá 200 ký tự']
  },
  
  // Nội dung thông báo
  message: {
    type: String,
    required: [true, 'Nội dung thông báo là bắt buộc'],
    trim: true,
    maxlength: [1000, 'Nội dung không được vượt quá 1000 ký tự']
  },
  
  // Dữ liệu chi tiết (JSON)
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Mức độ ưu tiên
  priority: {
    type: String,
    enum: {
      values: ['low', 'normal', 'high', 'critical'],
      message: '{VALUE} không phải là mức độ ưu tiên hợp lệ'
    },
    default: 'normal',
    index: true
  },
  
  // Trạng thái đọc
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Thời gian đọc
  readAt: {
    type: Date
  },
  
  // Trạng thái gửi
  deliveryStatus: {
    type: String,
    enum: {
      values: ['pending', 'sent', 'delivered', 'failed'],
      message: '{VALUE} không phải là trạng thái gửi hợp lệ'
    },
    default: 'pending',
    index: true
  },
  
  // Thời gian gửi
  sentAt: {
    type: Date
  },
  
  // Thời gian nhận (khi user online và nhận được qua socket)
  deliveredAt: {
    type: Date
  },
  
  // Thông tin metadata
  metadata: {
    // Channel gửi (socket, email, sms, push)
    channels: [{
      type: String,
      enum: ['socket', 'email', 'sms', 'push']
    }],
    
    // ID liên quan (requestId, accessLogId, etc.)
    relatedId: {
      type: mongoose.Schema.Types.ObjectId
    },
    
    // Model liên quan
    relatedModel: {
      type: String,
      enum: ['WorkingHoursRequest', 'AccessLog', 'User', 'Vehicle']
    },
    
    // Thông tin người gửi
    sender: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      type: {
        type: String,
        enum: ['system', 'user', 'admin', 'supervisor'],
        default: 'system'
      }
    },
    
    // Device info (nếu gửi qua mobile)
    deviceToken: String,
    
    // IP address của người nhận khi nhận thông báo
    receiverIP: String
  },
  
  // Thời gian hết hạn thông báo
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  }
}, {
  timestamps: true,
  collection: 'notifications'
});

// Indexes để tối ưu query
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, priority: 1, isRead: 1 });
notificationSchema.index({ deliveryStatus: 1, createdAt: -1 });

// Virtual cho thời gian còn lại trước khi hết hạn
notificationSchema.virtual('timeToExpire').get(function() {
  if (!this.expiresAt) return null;
  const now = new Date();
  const timeLeft = this.expiresAt.getTime() - now.getTime();
  return timeLeft > 0 ? timeLeft : 0;
});

// Method để đánh dấu đã đọc
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Method để cập nhật trạng thái gửi
notificationSchema.methods.updateDeliveryStatus = function(status, timestamp = new Date()) {
  this.deliveryStatus = status;
  
  if (status === 'sent') {
    this.sentAt = timestamp;
  } else if (status === 'delivered') {
    this.deliveredAt = timestamp;
  }
  
  return this.save();
};

// Static method để lấy thông báo chưa đọc của user
notificationSchema.statics.getUnreadByUser = function(userId, limit = 20) {
  return this.find({
    userId,
    isRead: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit)
  .populate('metadata.sender.id', 'name username')
  .exec();
};

// Static method để lấy thông báo theo type
notificationSchema.statics.getByType = function(userId, type, limit = 10) {
  return this.find({
    userId,
    type,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .exec();
};

// Static method để đếm thông báo chưa đọc
notificationSchema.statics.countUnread = function(userId) {
  return this.countDocuments({
    userId,
    isRead: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method để xóa thông báo cũ (cleanup)
notificationSchema.statics.cleanupOldNotifications = function(daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
};

// Pre-save middleware để set expiresAt mặc định
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Mặc định thông báo hết hạn sau 30 ngày
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    this.expiresAt = expiryDate;
  }
  next();
});

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
