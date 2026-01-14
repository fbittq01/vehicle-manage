import { TEMPLATE_HELPERS } from '../configs/notificationTypes.js';

/**
 * MessageBuilder - Xử lý template và build notification message
 */
export class MessageBuilder {
  
  /**
   * Build notification object từ config và data
   * @param {Object} config - Notification config
   * @param {Object} data - Raw data (workingHoursRequest, accessLog, etc.)
   * @param {Object} context - Additional context
   * @returns {Object} Notification object
   */
  static build(config, data, context = {}) {
    try {
      // Convert Mongoose document sang plain object trước khi flatten
      const plainData = this.toPlainObject(data);
      
      // Flatten data để dễ template replacement
      const flatData = this.flattenData(plainData);
      
      // Apply template helpers
      const processedData = this.applyHelpers(flatData);
      
      // Add reason if provided in context (for vehicle verification)
      if (context.reason && TEMPLATE_HELPERS.getVerificationReason) {
        processedData.reason = TEMPLATE_HELPERS.getVerificationReason(context.reason);
      }
      
      // Render template
      const message = this.renderTemplate(config.template, processedData);
      
      // Build final notification object
      return {
        type: config.type,
        title: config.title,
        message: message || `[Thông báo ${config.type}]`, // Fallback message
        data: this.prepareNotificationData(data, config),
        priority: this.resolvePriority(config.priority, data, context),
        timestamp: new Date(),
        ui: config.ui || {},
        metadata: {
          // Filter channels để chỉ lấy những giá trị hợp lệ trong enum
          channels: (config.channels || ['socket']).filter(ch => 
            ['socket', 'email', 'sms', 'push'].includes(ch)
          ),
          expiryDays: config.expiryDays,
          relatedId: this.extractRelatedId(data),
          relatedModel: this.getRelatedModel(config.type)
        }
      };
    } catch (error) {
      console.error('Error building notification:', error);
      throw error;
    }
  }

  /**
   * Convert Mongoose document sang plain JavaScript object
   * Loại bỏ các internal fields như _doc, $__, etc.
   * @param {any} data - Data có thể là Mongoose doc hoặc plain object
   * @returns {any} Plain object
   */
  static toPlainObject(data) {
    if (!data) return data;
    
    // Nếu là Mongoose document, dùng toObject() - ĐÃ XONG, return luôn
    if (data.constructor && (data.constructor.name === 'model' || data._doc || data.$__)) {
      if (typeof data.toObject === 'function') {
        return data.toObject(); // toObject() đã loại bỏ internal fields
      }
    }
    
    // Nếu là Array, convert từng phần tử
    if (Array.isArray(data)) {
      return data.map(item => this.toPlainObject(item));
    }
    
    // Nếu là plain object thuần, giữ nguyên
    if (typeof data === 'object' && data !== null && data.constructor === Object) {
      return data;
    }
    
    // Các kiểu khác (Date, Number, String, etc.) return nguyên
    return data;
  }

  /**
   * Flatten nested object để dễ template replacement
   * @param {Object} obj - Object cần flatten
   * @param {string} prefix - Prefix cho nested keys
   * @param {Set} visited - Set of visited objects (để tránh circular reference)
   * @param {number} depth - Current depth (để giới hạn độ sâu)
   * @returns {Object} Flattened object
   */
  static flattenData(obj, prefix = '', visited = new Set(), depth = 0) {
    const MAX_DEPTH = 5; // Giới hạn độ sâu để tránh infinite recursion
    const flattened = {};
    
    // Kiểm tra giới hạn độ sâu
    if (depth > MAX_DEPTH) {
      console.warn(`Max depth ${MAX_DEPTH} reached while flattening data at prefix: ${prefix}`);
      return flattened;
    }
    
    // Kiểm tra circular reference
    if (visited.has(obj)) {
      console.warn(`Circular reference detected at prefix: ${prefix}`);
      return flattened;
    }
    
    // Thêm vào visited set
    visited.add(obj);
    
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      
      const value = obj[key];
      
      // Skip null/undefined
      if (value === null || value === undefined) {
        flattened[prefix + key] = value;
        continue;
      }
      
      // Check if it's a primitive or special object
      const isPrimitive = typeof value !== 'object';
      const isDate = value instanceof Date;
      const isArray = Array.isArray(value);
      const isObjectId = value.constructor.name === 'ObjectId' || value._bsontype === 'ObjectId';
      
      if (isPrimitive || isDate || isArray || isObjectId) {
        // Convert ObjectId to string
        flattened[prefix + key] = isObjectId ? value.toString() : value;
      } else {
        // Recurse for nested objects
        try {
          const nested = this.flattenData(value, prefix + key + '.', visited, depth + 1);
          Object.assign(flattened, nested);
        } catch (error) {
          console.warn(`Error flattening nested object at ${prefix + key}:`, error.message);
          flattened[prefix + key] = '[Object]';
        }
      }
    }
    
    // Remove from visited set khi done
    visited.delete(obj);
    
    return flattened;
  }

  /**
   * Apply template helpers để transform data
   * @param {Object} data - Flattened data
   * @returns {Object} Processed data
   */
  static applyHelpers(data) {
    const processed = { ...data };
    
    // Apply các helper functions
    if (processed.requestType) {
      processed.requestType = TEMPLATE_HELPERS.getRequestTypeText(processed.requestType);
    }
    
    if (processed.status) {
      processed.status = TEMPLATE_HELPERS.getStatusText(processed.status);
    }
    
    if (processed.action) {
      processed.action = TEMPLATE_HELPERS.getActionText(processed.action);
    }
    
    if (processed.verificationStatus) {
      processed.verificationStatus = TEMPLATE_HELPERS.getVerificationStatusText(processed.verificationStatus);
    }
    
    return processed;
  }

  /**
   * Render template với data
   * @param {string} template - Template string
   * @param {Object} data - Flattened data (keys như 'requestedBy.name')
   * @returns {string} Rendered message
   */
  static renderTemplate(template, data) {
    return template.replace(/\{([^}]+)\}/g, (match, path) => {
      // Data đã flatten, nên tìm trực tiếp key (VD: data['requestedBy.name'])
      const value = data[path];
      return value !== undefined && value !== null ? value : match;
    });
  }

  /**
   * @param {string} path - Path như 'requestedBy.name'
   * @returns {any} Value hoặc undefined
   */
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Prepare notification data - chỉ lấy những field cần thiết
   * @param {Object} rawData - Raw data
   * @param {Object} config - Notification config
   * @returns {Object} Clean notification data
   */
  static prepareNotificationData(rawData, config) {
    const notificationData = {
      id: rawData._id,
      timestamp: rawData.createdAt || new Date()
    };

    // Thêm data tùy theo loại notification
    switch (config.type) {
      case 'working_hours_request':
      case 'working_hours_request_update':
        Object.assign(notificationData, {
          requestId: rawData._id,
          requestType: rawData.requestType,
          licensePlate: rawData.licensePlate,
          status: rawData.status,
          requestedBy: this.extractUserInfo(rawData.requestedBy),
          approvedBy: this.extractUserInfo(rawData.approvedBy),
          plannedDateTime: rawData.plannedDateTime,
          reason: rawData.reason
        });
        break;

      case 'vehicle_verification':
      case 'vehicle_verified':
      case 'access_log_verification': // backward compatibility
      case 'access_log_verified': // backward compatibility
      case 'unknown_vehicle_access': // backward compatibility
      case 'vehicle_access':
        Object.assign(notificationData, {
          accessLogId: rawData._id,
          licensePlate: rawData.licensePlate,
          action: rawData.action,
          gateId: rawData.gateId,
          gateName: rawData.gateName,
          owner: this.extractUserInfo(rawData.owner),
          verificationStatus: rawData.verificationStatus,
          verifiedBy: this.extractUserInfo(rawData.verifiedBy),
          confidence: rawData.recognitionData?.confidence,
          isVehicleRegistered: rawData.isVehicleRegistered
        });
        break;
    }

    return notificationData;
  }

  /**
   * Extract user info safely
   * @param {Object} user - User object
   * @returns {Object|null} Safe user info
   */
  static extractUserInfo(user) {
    if (!user) return null;
    
    return {
      id: user._id,
      name: user.name,
      username: user.username,
      department: user.department ? {
        id: user.department._id,
        name: user.department.name,
        code: user.department.code
      } : null
    };
  }

  /**
   * Resolve priority dựa trên config và data
   * @param {string} configPriority - Priority từ config
   * @param {Object} data - Raw data
   * @param {Object} context - Context
   * @returns {string} Final priority
   */
  static resolvePriority(configPriority, data, context) {
    // Có thể override priority dựa trên conditions
    
    // Ví dụ: Access log có confidence thấp thì high priority
    if (data.recognitionData?.confidence < 0.9 && configPriority === 'normal') {
      return 'high';
    }
    
    // Context priority override
    if (context.priority) {
      return context.priority;
    }
    
    return configPriority;
  }

  /**
   * Extract related ID từ data
   * @param {Object} data - Raw data
   * @returns {string} Related ID
   */
  static extractRelatedId(data) {
    return data._id?.toString();
  }

  /**
   * Get related model name
   * @param {string} notificationType - Notification type
   * @returns {string} Model name
   */
  static getRelatedModel(notificationType) {
    const modelMap = {
      'working_hours_request': 'WorkingHoursRequest',
      'working_hours_request_update': 'WorkingHoursRequest',
      'vehicle_verification': 'AccessLog',
      'vehicle_verified': 'AccessLog',
      'access_log_verification': 'AccessLog', // backward compatibility
      'access_log_verified': 'AccessLog', // backward compatibility
      'unknown_vehicle_access': 'AccessLog', // backward compatibility
      'vehicle_access': 'AccessLog'
    };
    return modelMap[notificationType] || null;
  }

  /**
   * Calculate expiry date
   * @param {number} expiryDays - Number of days
   * @param {string} priority - Priority level
   * @returns {Date} Expiry date
   */
  static calculateExpiryDate(expiryDays, priority) {
    const now = new Date();
    let adjustedDays = expiryDays;

    // Adjust theo priority
    switch (priority) {
      case 'critical':
        adjustedDays = Math.max(1, Math.floor(expiryDays / 2));
        break;
      case 'high':
        adjustedDays = Math.max(1, Math.floor(expiryDays * 0.7));
        break;
      case 'low':
        adjustedDays = expiryDays * 2;
        break;
    }

    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + adjustedDays);
    return expiryDate;
  }
}
