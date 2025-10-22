import crypto from 'crypto';

const IV_LENGTH = 16;
const ENCRYPTION_KEY = process.env.CAMERA_ENCRYPTION_KEY || 'default-32-char-key-for-camera!!';

export const encryptPassword = (text) => {
  if (!text) return '';

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '\0')).slice(0, 32);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

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
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '\0')).slice(0, 32);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
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
