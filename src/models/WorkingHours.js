import mongoose from 'mongoose';

const workingHoursSchema = new mongoose.Schema({
  // Tên cài đặt giờ làm việc
  name: {
    type: String,
    required: [true, 'Tên cài đặt là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên cài đặt không được vượt quá 100 ký tự']
  },
  
  // Giờ bắt đầu làm việc (format: HH:mm)
  startTime: {
    type: String,
    required: [true, 'Giờ bắt đầu là bắt buộc'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Giờ bắt đầu không hợp lệ (HH:mm)']
  },
  
  // Giờ kết thúc làm việc (format: HH:mm)
  endTime: {
    type: String,
    required: [true, 'Giờ kết thúc là bắt buộc'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Giờ kết thúc không hợp lệ (HH:mm)']
  },
  
  // Các ngày trong tuần áp dụng (0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7)
  workingDays: {
    type: [Number],
    required: [true, 'Ngày làm việc là bắt buộc'],
    validate: {
      validator: function(days) {
        return days.length > 0 && days.every(day => day >= 0 && day <= 6);
      },
      message: 'Ngày làm việc phải từ 0-6 (Chủ nhật đến Thứ 7)'
    }
  },
  
  // Cho phép muộn tối đa (phút)
  lateToleranceMinutes: {
    type: Number,
    default: 30,
    min: [0, 'Thời gian cho phép muộn không thể âm'],
    max: [120, 'Thời gian cho phép muộn không được vượt quá 120 phút']
  },
  
  // Cho phép về sớm tối đa (phút)
  earlyToleranceMinutes: {
    type: Number,
    default: 30,
    min: [0, 'Thời gian cho phép về sớm không thể âm'],
    max: [120, 'Thời gian cho phép về sớm không được vượt quá 120 phút']
  },
  
  // Trạng thái hoạt động
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Mô tả
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Mô tả không được vượt quá 500 ký tự']
  },
  
  // Người tạo
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index để tối ưu query
workingHoursSchema.index({ isActive: 1 });
workingHoursSchema.index({ createdBy: 1 });

// Method kiểm tra có phải giờ làm việc không
workingHoursSchema.methods.isWorkingTime = function(dateTime) {
  const date = new Date(dateTime);
  const dayOfWeek = date.getDay();
  const timeStr = date.toTimeString().substring(0, 5); // HH:mm
  
  // Kiểm tra có phải ngày làm việc không
  if (!this.workingDays.includes(dayOfWeek)) {
    return { isWorking: false, reason: 'Không phải ngày làm việc' };
  }
  
  // So sánh thời gian
  const isInWorkingHours = timeStr >= this.startTime && timeStr <= this.endTime;
  
  return {
    isWorking: isInWorkingHours,
    reason: isInWorkingHours ? 'Trong giờ làm việc' : 'Ngoài giờ làm việc',
    timeStr,
    dayOfWeek
  };
};

// Method kiểm tra có muộn giờ không
workingHoursSchema.methods.isLate = function(entryTime) {
  const date = new Date(entryTime);
  const dayOfWeek = date.getDay();
  const timeStr = date.toTimeString().substring(0, 5);
  
  if (!this.workingDays.includes(dayOfWeek)) {
    return { isLate: false, reason: 'Không phải ngày làm việc' };
  }
  
  // Kiểm tra có phải trong thời gian làm việc (từ startTime đến endTime)
  if (timeStr < this.startTime || timeStr > this.endTime) {
    return { isLate: false, reason: 'Ngoài giờ làm việc' };
  }
  
  // Tính thời gian cho phép muộn
  const [startHour, startMinute] = this.startTime.split(':').map(Number);
  const allowedLateTime = new Date(date);
  allowedLateTime.setHours(startHour, startMinute + this.lateToleranceMinutes, 0, 0);
  
  const actualTime = new Date(date);
  actualTime.setHours(...timeStr.split(':').map(Number), 0, 0);
  
  const isLate = actualTime > allowedLateTime;
  const lateMinutes = isLate ? Math.floor((actualTime - allowedLateTime) / (1000 * 60)) : 0;
  
  return {
    isLate,
    lateMinutes,
    allowedTime: this.startTime,
    actualTime: timeStr,
    toleranceMinutes: this.lateToleranceMinutes
  };
};

// Method kiểm tra có về sớm không
workingHoursSchema.methods.isEarly = function(exitTime) {
  const date = new Date(exitTime);
  const dayOfWeek = date.getDay();
  const timeStr = date.toTimeString().substring(0, 5);
  
  if (!this.workingDays.includes(dayOfWeek)) {
    return { isEarly: false, reason: 'Không phải ngày làm việc' };
  }
  
  // Kiểm tra có phải trong thời gian làm việc (từ startTime đến endTime)
  if (timeStr < this.startTime || timeStr > this.endTime) {
    return { isEarly: false, reason: 'Ngoài giờ làm việc' };
  }
  
  // Tính thời gian cho phép về sớm
  const [endHour, endMinute] = this.endTime.split(':').map(Number);
  const allowedEarlyTime = new Date(date);
  allowedEarlyTime.setHours(endHour, endMinute - this.earlyToleranceMinutes, 0, 0);
  
  const actualTime = new Date(date);
  actualTime.setHours(...timeStr.split(':').map(Number), 0, 0);
  
  const isEarly = actualTime < allowedEarlyTime;
  const earlyMinutes = isEarly ? Math.floor((allowedEarlyTime - actualTime) / (1000 * 60)) : 0;
  
  return {
    isEarly,
    earlyMinutes,
    allowedTime: this.endTime,
    actualTime: timeStr,
    toleranceMinutes: this.earlyToleranceMinutes
  };
};

// Static method lấy cài đặt giờ làm việc active
workingHoursSchema.statics.getActiveWorkingHours = function() {
  return this.findOne({ isActive: true }).populate('createdBy', 'name username');
};

export default mongoose.model('WorkingHours', workingHoursSchema);
