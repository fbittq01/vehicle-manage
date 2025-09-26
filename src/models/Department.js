import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên phòng ban là bắt buộc'],
    unique: true,
    trim: true,
    maxlength: [100, 'Tên phòng ban không được vượt quá 100 ký tự']
  },
  code: {
    type: String,
    required: [true, 'Mã phòng ban là bắt buộc'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [20, 'Mã phòng ban không được vượt quá 20 ký tự'],
    match: [/^[A-Z0-9_]+$/, 'Mã phòng ban chỉ được chứa chữ cái viết hoa, số và dấu gạch dưới']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Mô tả không được vượt quá 500 ký tự']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  parentDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  location: {
    building: {
      type: String,
      trim: true,
      maxlength: [100, 'Tên tòa nhà không được vượt quá 100 ký tự']
    },
    floor: {
      type: String,
      trim: true,
      maxlength: [10, 'Tầng không được vượt quá 10 ký tự']
    },
    room: {
      type: String,
      trim: true,
      maxlength: [20, 'Phòng không được vượt quá 20 ký tự']
    }
  },
  contact: {
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ']
    },
    extension: {
      type: String,
      trim: true,
      maxlength: [10, 'Số nội bộ không được vượt quá 10 ký tự']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      return ret;
    }
  }
});

// Indexes cho tìm kiếm hiệu quả
departmentSchema.index({ name: 1 });
departmentSchema.index({ code: 1 });
departmentSchema.index({ manager: 1 });
departmentSchema.index({ parentDepartment: 1 });
departmentSchema.index({ isActive: 1 });
departmentSchema.index({ createdBy: 1 });

// Virtual field để lấy danh sách phòng ban con
departmentSchema.virtual('subDepartments', {
  ref: 'Department',
  localField: '_id',
  foreignField: 'parentDepartment'
});

// Virtual field để đếm số nhân viên trong phòng ban
departmentSchema.virtual('employeeCount', {
  ref: 'User',
  localField: 'name',
  foreignField: 'department',
  count: true
});

// Static method tìm phòng ban active
departmentSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, isActive: true })
    .populate('manager', 'name username')
    .populate('parentDepartment', 'name code')
    .populate('createdBy', 'name username');
};

// Static method tìm phòng ban theo cấp bậc
departmentSchema.statics.findByLevel = function(level = 0) {
  const filter = level === 0 ? { parentDepartment: { $exists: false } } : { parentDepartment: { $exists: true } };
  return this.find({ ...filter, isActive: true })
    .populate('manager', 'name username')
    .populate('parentDepartment', 'name code');
};

// Static method tìm phòng ban gốc (không có parent)
departmentSchema.statics.findRootDepartments = function() {
  return this.find({ 
    parentDepartment: { $exists: false },
    isActive: true 
  }).populate('manager', 'name username');
};

// Static method tìm theo manager
departmentSchema.statics.findByManager = function(managerId) {
  return this.find({ 
    manager: managerId,
    isActive: true 
  }).populate('parentDepartment', 'name code');
};

// Instance method kiểm tra có phải phòng ban gốc không
departmentSchema.methods.isRootDepartment = function() {
  return !this.parentDepartment;
};

// Instance method lấy đường dẫn phân cấp phòng ban
departmentSchema.methods.getHierarchyPath = async function() {
  const path = [this.name];
  let current = this;
  
  while (current.parentDepartment) {
    current = await this.constructor.findById(current.parentDepartment);
    if (current) {
      path.unshift(current.name);
    } else {
      break;
    }
  }
  
  return path.join(' > ');
};

export default mongoose.model('Department', departmentSchema);
