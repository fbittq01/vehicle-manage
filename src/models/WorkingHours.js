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
  
  // Helper function để so sánh thời gian
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const currentMinutes = timeToMinutes(timeStr);
  const startMinutes = timeToMinutes(this.startTime);
  const endMinutes = timeToMinutes(this.endTime);
  
  // Kiểm tra có trong khoảng cấm không
  let isInRestrictedPeriod;
  const isOvernightShift = endMinutes < startMinutes;
  
  if (isOvernightShift) {
    // Ca qua đêm: trong khoảng cấm nếu >= startTime HOẶC <= endTime
    isInRestrictedPeriod = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  } else {
    // Ca thường: trong khoảng cấm nếu >= startTime VÀ <= endTime
    isInRestrictedPeriod = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  
  return {
    isWorking: !isInRestrictedPeriod, // Ngược lại: trong khoảng cấm = không được phép
    reason: isInRestrictedPeriod ? 'Trong khoảng thời gian cấm' : 'Ngoài khoảng thời gian cấm',
    timeStr,
    dayOfWeek
  };
};

// Method kiểm tra có vi phạm khi vào không (đi trong khoảng cấm)
workingHoursSchema.methods.isLate = function(entryTime) {
  const date = new Date(entryTime);
  const dayOfWeek = date.getDay();
  const timeStr = date.toTimeString().substring(0, 5);
  
  if (!this.workingDays.includes(dayOfWeek)) {
    return { isLate: false, reason: 'Không phải ngày làm việc' };
  }
  
  // Helper function
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const currentMinutes = timeToMinutes(timeStr);
  const startMinutes = timeToMinutes(this.startTime);
  const endMinutes = timeToMinutes(this.endTime);
  
  // Kiểm tra có trong khoảng cấm không
  let isInRestrictedPeriod;
  const isOvernightShift = endMinutes < startMinutes;
  
  if (isOvernightShift) {
    isInRestrictedPeriod = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  } else {
    isInRestrictedPeriod = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  
  if (!isInRestrictedPeriod) {
    return { isLate: false, reason: 'Ngoài khoảng thời gian cấm' };
  }
  
  // Tính số phút vi phạm (từ startTime đến thời điểm hiện tại)
  let lateMinutes;
  if (isOvernightShift) {
    if (currentMinutes >= startMinutes) {
      lateMinutes = currentMinutes - startMinutes;
    } else {
      lateMinutes = (1440 - startMinutes) + currentMinutes;
    }
  } else {
    lateMinutes = currentMinutes - startMinutes;
  }
  
  // Áp dụng tolerance
  lateMinutes = Math.max(0, lateMinutes - this.lateToleranceMinutes);
  
  return {
    isLate: true,
    lateMinutes,
    restrictedPeriod: `${this.startTime} - ${this.endTime}`,
    actualTime: timeStr,
    toleranceMinutes: this.lateToleranceMinutes
  };
};

// Method kiểm tra có vi phạm khi ra không (ra trong khoảng cấm)
workingHoursSchema.methods.isEarly = function(exitTime) {
  const date = new Date(exitTime);
  const dayOfWeek = date.getDay();
  const timeStr = date.toTimeString().substring(0, 5);
  
  if (!this.workingDays.includes(dayOfWeek)) {
    return { isEarly: false, reason: 'Không phải ngày làm việc' };
  }
  
  // Helper function
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const currentMinutes = timeToMinutes(timeStr);
  const startMinutes = timeToMinutes(this.startTime);
  const endMinutes = timeToMinutes(this.endTime);
  
  // Kiểm tra có trong khoảng cấm không
  let isInRestrictedPeriod;
  const isOvernightShift = endMinutes < startMinutes;
  
  if (isOvernightShift) {
    isInRestrictedPeriod = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  } else {
    isInRestrictedPeriod = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  
  if (!isInRestrictedPeriod) {
    return { isEarly: false, reason: 'Ngoài khoảng thời gian cấm' };
  }
  
  // Tính số phút vi phạm (từ thời điểm hiện tại đến endTime)
  let earlyMinutes;
  if (isOvernightShift) {
    if (currentMinutes <= endMinutes) {
      earlyMinutes = endMinutes - currentMinutes;
    } else {
      earlyMinutes = (1440 - currentMinutes) + endMinutes;
    }
  } else {
    earlyMinutes = endMinutes - currentMinutes;
  }
  
  // Áp dụng tolerance
  earlyMinutes = Math.max(0, earlyMinutes - this.earlyToleranceMinutes);
  
  return {
    isEarly: true,
    earlyMinutes,
    restrictedPeriod: `${this.startTime} - ${this.endTime}`,
    actualTime: timeStr,
    toleranceMinutes: this.earlyToleranceMinutes
  };
};

// Static method lấy tất cả cài đặt giờ làm việc active (cho phép nhiều cùng lúc)
workingHoursSchema.statics.getActiveWorkingHours = function() {
  return this.find({ isActive: true }).populate('createdBy', 'name username');
};

export default mongoose.model('WorkingHours', workingHoursSchema);
