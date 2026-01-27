import dotenv from 'dotenv';

dotenv.config();

/**
 * MediaMTX Service
 * 
 * Service để quản lý paths trong MediaMTX server thông qua Control API.
 * MediaMTX là streaming server hỗ trợ RTSP/HLS/WebRTC.
 * 
 * Lưu ý: Các thay đổi qua API KHÔNG được lưu vào mediamtx.yml 
 * và sẽ mất khi MediaMTX restart. Service này tự động đồng bộ lại
 * paths khi Node.js server khởi động.
 */

class MediaMTXService {
  constructor() {
    this.baseUrl = process.env.MEDIAMTX_API_URL || 'http://localhost:9997';
    this.timeout = parseInt(process.env.MEDIAMTX_API_TIMEOUT || '5000', 10);
    this.enabled = process.env.MEDIAMTX_ENABLED !== 'false'; // Default: enabled
  }

  /**
   * Kiểm tra xem MediaMTX service có enabled không
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Tạo fetch request với timeout
   */
  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`MediaMTX API timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Thêm path mới vào MediaMTX
   * 
   * @param {string} cameraId - Camera ID (sẽ dùng làm path name)
   * @param {string} streamUrl - RTSP stream URL
   * @returns {Promise<{success: boolean, message: string, data?: any}>}
   */
  async addPath(cameraId, streamUrl) {
    if (!this.enabled) {
      return { 
        success: false, 
        message: 'MediaMTX service is disabled' 
      };
    }

    if (!cameraId || !streamUrl) {
      return { 
        success: false, 
        message: 'Camera ID and stream URL are required' 
      };
    }

    try {
      const url = `${this.baseUrl}/v3/config/paths/add/${encodeURIComponent(cameraId)}`;
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: streamUrl,
        }),
      });

      if (response.ok) {
        console.log(`✅ MediaMTX: Added path for camera ${cameraId}`);
        return { 
          success: true, 
          message: `Path added successfully for ${cameraId}`,
          data: await response.json().catch(() => ({}))
        };
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ MediaMTX: Failed to add path for ${cameraId}: ${response.status} ${errorText}`);
        return { 
          success: false, 
          message: `Failed to add path: ${response.status} ${errorText}` 
        };
      }
    } catch (error) {
      console.error(`❌ MediaMTX: Error adding path for ${cameraId}:`, error.message);
      return { 
        success: false, 
        message: `Error adding path: ${error.message}` 
      };
    }
  }

  /**
   * Cập nhật path trong MediaMTX
   * 
   * @param {string} cameraId - Camera ID
   * @param {string} streamUrl - RTSP stream URL mới
   * @returns {Promise<{success: boolean, message: string, data?: any}>}
   */
  async updatePath(cameraId, streamUrl) {
    if (!this.enabled) {
      return { 
        success: false, 
        message: 'MediaMTX service is disabled' 
      };
    }

    if (!cameraId || !streamUrl) {
      return { 
        success: false, 
        message: 'Camera ID and stream URL are required' 
      };
    }

    try {
      const url = `${this.baseUrl}/v3/config/paths/patch/${encodeURIComponent(cameraId)}`;
      const response = await this.fetchWithTimeout(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: streamUrl,
        }),
      });

      if (response.ok) {
        console.log(`✅ MediaMTX: Updated path for camera ${cameraId}`);
        return { 
          success: true, 
          message: `Path updated successfully for ${cameraId}`,
          data: await response.json().catch(() => ({}))
        };
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ MediaMTX: Failed to update path for ${cameraId}: ${response.status} ${errorText}`);
        return { 
          success: false, 
          message: `Failed to update path: ${response.status} ${errorText}` 
        };
      }
    } catch (error) {
      console.error(`❌ MediaMTX: Error updating path for ${cameraId}:`, error.message);
      return { 
        success: false, 
        message: `Error updating path: ${error.message}` 
      };
    }
  }

  /**
   * Xóa path khỏi MediaMTX
   * 
   * @param {string} cameraId - Camera ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deletePath(cameraId) {
    if (!this.enabled) {
      return { 
        success: false, 
        message: 'MediaMTX service is disabled' 
      };
    }

    if (!cameraId) {
      return { 
        success: false, 
        message: 'Camera ID is required' 
      };
    }

    try {
      const url = `${this.baseUrl}/v3/config/paths/delete/${encodeURIComponent(cameraId)}`;
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log(`✅ MediaMTX: Deleted path for camera ${cameraId}`);
        return { 
          success: true, 
          message: `Path deleted successfully for ${cameraId}` 
        };
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ MediaMTX: Failed to delete path for ${cameraId}: ${response.status} ${errorText}`);
        return { 
          success: false, 
          message: `Failed to delete path: ${response.status} ${errorText}` 
        };
      }
    } catch (error) {
      console.error(`❌ MediaMTX: Error deleting path for ${cameraId}:`, error.message);
      return { 
        success: false, 
        message: `Error deleting path: ${error.message}` 
      };
    }
  }

  /**
   * Lấy thông tin path từ MediaMTX
   * 
   * @param {string} cameraId - Camera ID
   * @returns {Promise<{success: boolean, message: string, data?: any}>}
   */
  async getPath(cameraId) {
    if (!this.enabled) {
      return { 
        success: false, 
        message: 'MediaMTX service is disabled' 
      };
    }

    if (!cameraId) {
      return { 
        success: false, 
        message: 'Camera ID is required' 
      };
    }

    try {
      const url = `${this.baseUrl}/v3/config/paths/get/${encodeURIComponent(cameraId)}`;
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        return { 
          success: true, 
          message: `Path retrieved successfully for ${cameraId}`,
          data 
        };
      } else {
        const errorText = await response.text();
        return { 
          success: false, 
          message: `Failed to get path: ${response.status} ${errorText}` 
        };
      }
    } catch (error) {
      console.error(`❌ MediaMTX: Error getting path for ${cameraId}:`, error.message);
      return { 
        success: false, 
        message: `Error getting path: ${error.message}` 
      };
    }
  }

  /**
   * Đồng bộ tất cả cameras từ database vào MediaMTX
   * Dùng khi server khởi động để restore paths (vì MediaMTX API không persistent)
   * 
   * @param {Array} cameras - Mảng camera objects từ database
   * @returns {Promise<{total: number, success: number, failed: number, errors: Array}>}
   */
  async syncAllPaths(cameras) {
    if (!this.enabled) {
      console.log('⚠️ MediaMTX service is disabled, skipping sync');
      return { 
        total: 0, 
        success: 0, 
        failed: 0, 
        errors: [] 
      };
    }

    console.log(`🔄 MediaMTX: Starting sync for ${cameras.length} cameras...`);

    const results = {
      total: cameras.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const camera of cameras) {
      // Chỉ sync cameras có streamUrl
      if (!camera.technical?.streamUrl) {
        console.log(`⏭️ MediaMTX: Skipping ${camera.cameraId} - no stream URL`);
        continue;
      }

      // Chỉ sync active cameras
      if (!camera.status?.isActive) {
        console.log(`⏭️ MediaMTX: Skipping ${camera.cameraId} - inactive`);
        continue;
      }

      const result = await this.addPath(camera.cameraId, camera.technical.streamUrl);
      
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          cameraId: camera.cameraId,
          error: result.message,
        });
      }
    }

    console.log(`✅ MediaMTX: Sync completed - ${results.success}/${results.total} succeeded, ${results.failed} failed`);
    
    if (results.errors.length > 0) {
      console.warn('⚠️ MediaMTX: Errors during sync:', results.errors);
    }

    return results;
  }

  /**
   * Kiểm tra MediaMTX server có khả dụng không
   * 
   * @returns {Promise<{available: boolean, message: string}>}
   */
  async checkHealth() {
    if (!this.enabled) {
      return { 
        available: false, 
        message: 'MediaMTX service is disabled' 
      };
    }

    try {
      const url = `${this.baseUrl}/v3/config/global/get`;
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
      });

      if (response.ok) {
        return { 
          available: true, 
          message: 'MediaMTX server is available' 
        };
      } else {
        return { 
          available: false, 
          message: `MediaMTX server returned ${response.status}` 
        };
      }
    } catch (error) {
      return { 
        available: false, 
        message: `MediaMTX server is not accessible: ${error.message}` 
      };
    }
  }
}

// Export singleton instance
const mediamtxService = new MediaMTXService();
export default mediamtxService;
