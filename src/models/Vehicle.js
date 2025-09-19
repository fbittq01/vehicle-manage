import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  licensePlate: {
    type: String,
    required: [true, 'Biển số xe là bắt buộc'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[0-9]{2}[A-Z]{1,2}-[0-9]{3,4}\.[0-9]{2}$|^[0-9]{2}[A-Z]{1,2}[0-9]{3,4}$/, 'Biển số xe không hợp lệ']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Chủ sở hữu là bắt buộc']
  },
  vehicleType: {
    type: String,
    enum: {
      values: ['car', 'motorcycle', 'truck', 'bus', 'bicycle', 'other'],
      message: '{VALUE} không phải là loại xe hợp lệ'
    },
    required: [true, 'Loại xe là bắt buộc']
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [50, 'Hãng xe không được vượt quá 50 ký tự']
  },
  model: {
    type: String,
    trim: true,
    maxlength: [50, 'Model xe không được vượt quá 50 ký tự']
  },
  color: {
    type: String,
    trim: true,
    maxlength: [30, 'Màu xe không được vượt quá 30 ký tự']
  },
  year: {
    type: Number,
    min: [1900, 'Năm sản xuất không hợp lệ'],
    max: [new Date().getFullYear() + 1, 'Năm sản xuất không hợp lệ']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Mô tả không được vượt quá 500 ký tự']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  // Thông tin bảo hiểm
  insurance: {
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Tên công ty bảo hiểm không được vượt quá 100 ký tự']
    },
    policyNumber: {
      type: String,
      trim: true,
      maxlength: [50, 'Số hợp đồng bảo hiểm không được vượt quá 50 ký tự']
    },
    expiryDate: {
      type: Date
    }
  },
  // Lịch sử bảo trì
  maintenanceHistory: [{
    date: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    cost: {
      type: Number,
      min: 0
    },
    serviceProvider: {
      type: String,
      trim: true
    }
  }]
}, {
  timestamps: true
});

// Indexes cho tìm kiếm hiệu quả
vehicleSchema.index({ licensePlate: 1 });
vehicleSchema.index({ owner: 1 });
vehicleSchema.index({ vehicleType: 1 });
vehicleSchema.index({ isActive: 1 });
vehicleSchema.index({ registrationDate: -1 });
vehicleSchema.index({ 'insurance.expiryDate': 1 });

// Virtual field để kiểm tra xe sắp hết hạn bảo hiểm
vehicleSchema.virtual('insuranceExpiringSoon').get(function() {
  if (!this.insurance.expiryDate) return false;
  const today = new Date();
  const daysDiff = Math.ceil((this.insurance.expiryDate - today) / (1000 * 60 * 60 * 24));
  return daysDiff <= 30 && daysDiff >= 0;
});

// Virtual field để kiểm tra xe hết hạn đăng ký
vehicleSchema.virtual('registrationExpired').get(function() {
  if (!this.expiryDate) return false;
  return this.expiryDate < new Date();
});

// Static method tìm xe active
vehicleSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, isActive: true }).populate('owner', 'name email phone');
};

// Static method tìm xe theo chủ sở hữu
vehicleSchema.statics.findByOwner = function(ownerId) {
  return this.find({ owner: ownerId, isActive: true });
};

// Static method tìm xe sắp hết hạn bảo hiểm
vehicleSchema.statics.findInsuranceExpiring = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    isActive: true,
    'insurance.expiryDate': {
      $lte: futureDate,
      $gte: new Date()
    }
  }).populate('owner', 'name email phone');
};

// Method thêm lịch sử bảo trì
vehicleSchema.methods.addMaintenanceRecord = function(maintenanceData) {
  this.maintenanceHistory.push({
    ...maintenanceData,
    date: maintenanceData.date || new Date()
  });
  return this.save();
};

export default mongoose.model('Vehicle', vehicleSchema);
