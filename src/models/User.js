import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username là bắt buộc'],
    unique: true,
    lowercase: true,
    trim: true,
    minlength: [3, 'Username phải có ít nhất 3 ký tự'],
    maxlength: [50, 'Username không được vượt quá 50 ký tự'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username chỉ được chứa chữ cái, số và dấu gạch dưới']
  },
  password: {
    type: String,
    required: [true, 'Mật khẩu là bắt buộc'],
    minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự']
  },
  name: {
    type: String,
    required: [true, 'Tên là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên không được vượt quá 100 ký tự']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ']
  },
  role: {
    type: String,
    enum: {
      values: ['super_admin', 'admin', 'user'],
      message: '{VALUE} không phải là role hợp lệ'
    },
    default: 'user'
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Phòng ban không được vượt quá 100 ký tự']
  },
  employeeId: {
    type: String,
    trim: true,
    sparse: true, // Cho phép null nhưng unique khi có giá trị
    maxlength: [50, 'Mã nhân viên không được vượt quá 50 ký tự']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  refreshTokens: [{
    token: String,
    expiresAt: Date
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshTokens;
      return ret;
    }
  }
});

// Index cho tìm kiếm
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ employeeId: 1 }, { sparse: true });

// Middleware mã hóa mật khẩu trước khi save
userSchema.pre('save', async function(next) {
  // Chỉ hash password khi nó được modified
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password với cost factor 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method so sánh mật khẩu
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method để clean up expired refresh tokens
userSchema.methods.cleanExpiredTokens = function() {
  this.refreshTokens = this.refreshTokens.filter(
    tokenObj => tokenObj.expiresAt > new Date()
  );
};

// Static method tìm user active
userSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, isActive: true });
};

export default mongoose.model('User', userSchema);
