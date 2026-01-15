import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base path cho uploads
const UPLOADS_BASE_PATH = path.join(__dirname, '../../uploads');

/**
 * Lưu ảnh base64 vào local storage
 * @param {string} base64Data - Dữ liệu ảnh dạng base64 (có thể có prefix data:image/...)
 * @param {string} folder - Thư mục con để lưu (ví dụ: 'access-logs')
 * @param {string} filename - Tên file (không có extension)
 * @returns {Promise<string>} - Đường dẫn URL của file đã lưu
 */
export const saveBase64Image = async (base64Data, folder, filename) => {
  try {
    // Kiểm tra và xử lý base64 data
    let imageData = base64Data;
    let fileExtension = 'jpg'; // Default extension

    // Nếu có prefix data:image/..., extract data và extension
    if (base64Data.startsWith('data:image/')) {
      const matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (matches) {
        fileExtension = matches[1];
        imageData = matches[2];
      }
    }

    // Tạo buffer từ base64
    const buffer = Buffer.from(imageData, 'base64');

    // Tạo đường dẫn thư mục
    const folderPath = path.join(UPLOADS_BASE_PATH, folder);
    await fs.mkdir(folderPath, { recursive: true });

    // Tạo tên file cuối cùng (filename đã có timestamp và random suffix)
    const finalFilename = `${filename}.${fileExtension}`;
    const filePath = path.join(folderPath, finalFilename);

    // Lưu file
    await fs.writeFile(filePath, buffer);

    // Trả về URL relative từ uploads folder
    return `/uploads/${folder}/${finalFilename}`;
  } catch (error) {
    console.error('Lỗi khi lưu ảnh base64:', error);
    throw new Error('Không thể lưu ảnh vào storage');
  }
};

/**
 * Kiểm tra xem string có phải là base64 image không
 * @param {string} str - String cần kiểm tra
 * @returns {boolean} - True nếu là base64 image
 */
export const isBase64Image = (str) => {
  if (!str || typeof str !== 'string') return false;
  
  // Kiểm tra prefix data:image/
  if (str.startsWith('data:image/')) {
    return true;
  }
  
  // Kiểm tra base64 thuần (không có prefix)
  // Base64 image thường rất dài (>100 ký tự) và chỉ chứa A-Z, a-z, 0-9, +, /, =
  if (str.length > 100 && /^[A-Za-z0-9+/=]+$/.test(str)) {
    return true;
  }
  
  return false;
};

/**
 * Kiểm tra xem string có phải là base64 video không
 * @param {string} str - String cần kiểm tra
 * @returns {boolean} - True nếu là base64 video
 */
export const isBase64Video = (str) => {
  if (!str || typeof str !== 'string') return false;
  
  // Kiểm tra prefix data:video/
  if (str.startsWith('data:video/')) {
    return true;
  }
  
  return false;
};

/**
 * Lưu video base64 vào local storage
 * @param {string} base64Data - Dữ liệu video dạng base64 (có prefix data:video/...)
 * @param {string} folder - Thư mục con để lưu (ví dụ: 'access-logs')
 * @param {string} filename - Tên file (không có extension)
 * @returns {Promise<string>} - Đường dẫn URL của file đã lưu
 */
export const saveBase64Video = async (base64Data, folder, filename) => {
  try {
    let videoData = base64Data;
    let fileExtension = 'mp4'; // Default extension

    // Nếu có prefix data:video/..., extract data và extension
    if (base64Data.startsWith('data:video/')) {
      const matches = base64Data.match(/^data:video\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (matches) {
        fileExtension = matches[1];
        videoData = matches[2];
      }
    }

    // Tạo buffer từ base64
    const buffer = Buffer.from(videoData, 'base64');

    // Tạo đường dẫn thư mục
    const folderPath = path.join(UPLOADS_BASE_PATH, folder);
    await fs.mkdir(folderPath, { recursive: true });

    // Tạo tên file cuối cùng
    const finalFilename = `${filename}.${fileExtension}`;
    const filePath = path.join(folderPath, finalFilename);

    // Lưu file
    await fs.writeFile(filePath, buffer);

    // Trả về URL relative từ uploads folder
    return `/uploads/${folder}/${finalFilename}`;
  } catch (error) {
    console.error('Lỗi khi lưu video base64:', error);
    throw new Error('Không thể lưu video vào storage');
  }
};

/**
 * Xóa file ảnh từ local storage
 * @param {string} imageUrl - URL của ảnh cần xóa (ví dụ: /uploads/access-logs/image_123456.jpg)
 * @returns {Promise<boolean>} - True nếu xóa thành công
 */
export const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) {
      return false;
    }

    const filePath = path.join(__dirname, '../..', imageUrl);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error('Lỗi khi xóa ảnh:', error);
    return false;
  }
};

/**
 * Xử lý recognition data để lưu ảnh base64 và trả về URLs
 * @param {object} recognitionData - Dữ liệu recognition từ request
 * @param {string} licensePlate - Biển số xe để đặt tên file
 * @param {string} action - Action (entry/exit) để đặt tên file
 * @returns {Promise<object>} - Recognition data đã được xử lý với URLs
 */
export const processRecognitionImages = async (recognitionData, licensePlate, action) => {
  if (!recognitionData) return recognitionData;

  const processedData = { ...recognitionData };
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 ký tự random
  const safeFileName = licensePlate.replace(/[^a-zA-Z0-9]/g, '_');

  try {
    // Xử lý processedImage
    if (recognitionData.processedImage && isBase64Image(recognitionData.processedImage)) {
      const filename = `${safeFileName}_${action}_processed_${timestamp}_${randomSuffix}`;
      processedData.processedImage = await saveBase64Image(
        recognitionData.processedImage,
        'access-logs',
        filename
      );
    }

    // Xử lý originalImage
    if (recognitionData.originalImage && isBase64Image(recognitionData.originalImage)) {
      const filename = `${safeFileName}_${action}_original_${timestamp}_${randomSuffix}`;
      processedData.originalImage = await saveBase64Image(
        recognitionData.originalImage,
        'access-logs',
        filename
      );
    }

    // Xử lý videoUrl (video base64)
    if (recognitionData.videoUrl && isBase64Video(recognitionData.videoUrl)) {
      const filename = `${safeFileName}_${action}_video_${timestamp}_${randomSuffix}`;
      processedData.videoUrl = await saveBase64Video(
        recognitionData.videoUrl,
        'videos',
        filename
      );
    }

    return processedData;
  } catch (error) {
    console.error('Lỗi khi xử lý ảnh recognition:', error);
    // Trả về data gốc nếu có lỗi
    return recognitionData;
  }
};
