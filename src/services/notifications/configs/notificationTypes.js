/**
 * Notification Type Configurations
 * Tập trung tất cả config notification ở một nơi để dễ quản lý
 */

export const NOTIFICATION_TYPES = {
  WORKING_HOURS_REQUEST: {
    type: 'working_hours_request',
    audience: 'department_admins',
    template: '{requestedBy.name} đã tạo yêu cầu {requestType} cho xe {licensePlate}',
    title: 'Yêu cầu ra/vào mới',
    priority: 'normal',
    expiryDays: 7,
    requiresPopulate: ['requestedBy', 'requestedBy.department'],
    channels: ['socket'],
    ui: {
      showModal: false,
      playSound: true,
      badge: true,
      icon: '🚗'
    }
  },

  WORKING_HOURS_REQUEST_UPDATE: {
    type: 'working_hours_request_update',
    audience: 'requester',
    template: 'Yêu cầu {requestType} cho xe {licensePlate} đã được {status}',
    title: 'Cập nhật yêu cầu ra/vào',
    priority: 'normal',
    expiryDays: 3,
    requiresPopulate: ['requestedBy', 'approvedBy'],
    channels: ['socket'],
    ui: {
      showModal: false,
      playSound: true,
      badge: true,
      icon: '✅'
    }
  },

  VEHICLE_VERIFICATION: {
    type: 'vehicle_verification',
    audience: 'supervisors',
    template: 'Xe {licensePlate} {action} tại {gateName} cần xác minh{reason}',
    title: 'Xe cần xác minh',
    priority: 'normal',
    expiryDays: 1,
    requiresPopulate: ['owner', 'owner.department', 'vehicle'],
    channels: ['socket'],
    ui: {
      showModal: false,
      playSound: true,
      badge: true,
      icon: '❓'
    }
  },

  VEHICLE_VERIFIED: {
    type: 'vehicle_verified',
    audience: 'vehicle_owner',
    template: 'Xe {licensePlate} đã được {verificationStatus} bởi {verifiedBy.name}',
    title: 'Xe đã được xác minh',
    priority: 'normal',
    expiryDays: 7,
    requiresPopulate: ['owner', 'verifiedBy'],
    channels: ['socket'],
    ui: {
      showModal: false,
      playSound: false,
      badge: true,
      icon: '✅'
    }
  },

  VEHICLE_ACCESS: {
    type: 'vehicle_access',
    audience: 'supervisors',
    template: 'Xe {licensePlate} {action} tại {gateName}',
    title: 'Xe ra/vào',
    priority: 'low',
    expiryDays: 3,
    requiresPopulate: ['owner', 'owner.department', 'vehicle'],
    channels: ['socket'],
    ui: {
      showModal: false,
      playSound: false,
      badge: false,
      icon: '🚗'
    }
  }
};

/**
 * Priority levels mapping
 */
export const PRIORITY_LEVELS = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4
};

/**
 * Audience types mapping
 */
export const AUDIENCE_TYPES = {
  SUPERVISORS: 'supervisors',
  DEPARTMENT_ADMINS: 'department_admins', 
  REQUESTER: 'requester',
  VEHICLE_OWNER: 'vehicle_owner',
  SPECIFIC_USER: 'specific_user'
};

/**
 * Template helpers - các function hỗ trợ render template
 */
export const TEMPLATE_HELPERS = {
  getRequestTypeText(requestType) {
    const typeMap = {
      'entry': 'vào',
      'exit': 'ra',
      'both': 'ra/vào'
    };
    return typeMap[requestType] || requestType;
  },

  getStatusText(status) {
    const statusMap = {
      'pending': 'chờ duyệt',
      'approved': 'phê duyệt',  
      'rejected': 'từ chối',
      'expired': 'hết hạn'
    };
    return statusMap[status] || status;
  },

  getActionText(action) {
    return action === 'entry' ? 'vào' : 'ra';
  },

  getVerificationStatusText(status) {
    return status === 'approved' ? 'phê duyệt' : 'từ chối';
  },

  getVerificationReason(reason) {
    const reasonMap = {
      'unknown_vehicle': ' - Xe lạ phát hiện',
      'low_confidence': ' - Độ tin cậy thấp',
      'suspicious_activity': ' - Hoạt động bất thường',
      'manual_review': ''
    };
    return reasonMap[reason] || '';
  }
};
