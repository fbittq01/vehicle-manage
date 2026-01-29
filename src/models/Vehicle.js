import mongoose from 'mongoose';
import { formatLicensePlate } from '../utils/licensePlate.js';

const vehicleSchema = new mongoose.Schema({
  licensePlate: {
    type: String,
    required: [true, 'Biển số xe là bắt buộc'],
    unique: true,
    uppercase: true,
    trim: true,
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
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Tên xe không được vượt quá 100 ký tự']
  },
  color: {
    type: String,
    trim: true,
    maxlength: [30, 'Màu xe không được vượt quá 30 ký tự']
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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field để format biển số về dạng đẹp
vehicleSchema.virtual('formattedLicensePlate').get(function() {
  return formatLicensePlate(this.licensePlate);
});

// Indexes cho tìm kiếm hiệu quả
vehicleSchema.index({ licensePlate: 1 });
vehicleSchema.index({ owner: 1 });
vehicleSchema.index({ vehicleType: 1 });
vehicleSchema.index({ isActive: 1 });

// Static method tìm xe active
vehicleSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, isActive: true }).populate('owner', 'name username phone');
};

// Static method tìm xe theo chủ sở hữu
vehicleSchema.statics.findByOwner = function(ownerId) {
  return this.find({ owner: ownerId, isActive: true });
};

export default mongoose.model('Vehicle', vehicleSchema);
