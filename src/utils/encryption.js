import crypto from 'crypto';

// Key và IV cho encryption/decryption - nên lưu trong env variable
const ENCRYPTION_KEY = process.env.CAMERA_ENCRYPTION_KEY || 'default-32-char-key-for-camera!!'; // 32 characters
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Mã hóa mật khẩu camera
 * @param {string} text - Mật khẩu gốc cần mã hóa
 * @returns {string} - Mật khẩu đã được mã hóa (format: iv:encrypted)
 */
export const encryptPassword = (text) => {
  if (!text) return '';
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Kết hợp IV và encrypted text
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Error encrypting password:', error);
    throw new Error('Không thể mã hóa mật khẩu');
  }
};

/**
 * Giải mã mật khẩu camera
 * @param {string} encryptedText - Mật khẩu đã mã hóa (format: iv:encrypted)
 * @returns {string} - Mật khẩu gốc
 */
export const decryptPassword = (encryptedText) => {
  if (!encryptedText) return '';
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Format mật khẩu mã hóa không hợp lệ');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting password:', error);
    throw new Error('Không thể giải mã mật khẩu');
  }
};

/**
 * Hash mật khẩu với bcrypt (để lưu trữ an toàn)
 * @param {string} password - Mật khẩu gốc
 * @returns {string} - Mật khẩu đã hash
 */
export const hashPassword = async (password) => {
  if (!password) return '';
  
  try {
    const bcrypt = await import('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Không thể hash mật khẩu');
  }
};

/**
 * So sánh mật khẩu với hash
 * @param {string} password - Mật khẩu gốc
 * @param {string} hashedPassword - Mật khẩu đã hash
 * @returns {boolean} - True nếu khớp
 */
export const comparePassword = async (password, hashedPassword) => {
  if (!password || !hashedPassword) return false;
  
  try {
    const bcrypt = await import('bcryptjs');
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('Error comparing password:', error);
    return false;
  }
};
