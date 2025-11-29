import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication actions
      'LOGIN',
      'LOGOUT',
      'CHANGE_PASSWORD',
      'RESET_PASSWORD',
      'FORGOT_PASSWORD',
      
      // User management actions
      'CREATE_USER',
      'UPDATE_USER',
      'DELETE_USER',
      'UPDATE_PROFILE',
      'CHANGE_ROLE',
      'ACTIVATE_USER',
      'DEACTIVATE_USER',
      'VIEW_USER',
      'BULK_UPDATE_USERS',
      
      // Vehicle management actions
      'CREATE_VEHICLE',
      'UPDATE_VEHICLE',
      'DELETE_VEHICLE',
      'VIEW_VEHICLE',
      'ASSIGN_VEHICLE',
      'UNASSIGN_VEHICLE',
      'CHANGE_VEHICLE_STATUS',
      'BULK_CREATE_VEHICLES',
      'BULK_UPDATE_VEHICLES',
      'BULK_DELETE_VEHICLES',
      'EXPORT_VEHICLES',
      'IMPORT_VEHICLES',
      
      // Department management actions
      'CREATE_DEPARTMENT',
      'UPDATE_DEPARTMENT',
      'DELETE_DEPARTMENT',
      'VIEW_DEPARTMENT',
      'ASSIGN_USER_TO_DEPARTMENT',
      'REMOVE_USER_FROM_DEPARTMENT',
      'CHANGE_DEPARTMENT_HEAD',
      'ACTIVATE_DEPARTMENT',
      'DEACTIVATE_DEPARTMENT',
      
      // Working Hour management actions
      'CREATE_WORKING_HOUR',
      'UPDATE_WORKING_HOUR',
      'DELETE_WORKING_HOUR',
      'ACTIVATE_WORKING_HOUR',
      'VIEW_WORKING_HOUR',
      'APPROVE_WORKING_HOUR',
      'REJECT_WORKING_HOUR',
      'SUBMIT_WORKING_HOUR',
      'CALCULATE_OVERTIME',
      'EXPORT_WORKING_HOURS',
      'IMPORT_WORKING_HOURS',
      
      // Working Hours Request actions
      'CREATE_WORKING_HOURS_REQUEST',
      'UPDATE_WORKING_HOURS_REQUEST',
      'DELETE_WORKING_HOURS_REQUEST',
      'APPROVE_WORKING_HOURS_REQUEST',
      'REJECT_WORKING_HOURS_REQUEST',
      'SUBMIT_WORKING_HOURS_REQUEST',
      'VIEW_WORKING_HOURS_REQUEST',
      
      // Camera management actions
      'CREATE_CAMERA',
      'UPDATE_CAMERA',
      'DELETE_CAMERA',
      'VIEW_CAMERA',
      'ACTIVATE_CAMERA',
      'DEACTIVATE_CAMERA',
      'TEST_CAMERA',
      'CONFIGURE_CAMERA',
      
      // Access Log actions
      'VIEW_ACCESS_LOG',
      'CREATE_ACCESS_LOG',
      'UPDATE_ACCESS_LOG',
      'DELETE_ACCESS_LOG',
      'EXPORT_ACCESS_LOGS',
      'PROCESS_ACCESS_LOG',
      
      // Report and analytics actions
      'VIEW_REPORT',
      'GENERATE_REPORT',
      'EXPORT_DATA',
      'IMPORT_DATA',
      'VIEW_ANALYTICS',
      'VIEW_DASHBOARD',
      
      // System actions
      'BACKUP_DATA',
      'RESTORE_DATA',
      'CLEAR_LOGS',
      'SYSTEM_MAINTENANCE',
      'UPDATE_SETTINGS',

      // Notification actions
      'VIEW_NOTIFICATION',
      'UPDATE_NOTIFICATION',
    ]
  },
  resource: {
    type: String, // Table/Model name (vehicles, users, departments, working_hours, etc.)
    required: false
  },
  resourceId: {
    type: String, // ID of the affected resource
    required: false
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Additional details about the action
    required: false
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED'],
    default: 'SUCCESS'
  },
  errorMessage: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Index cho performance
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ resource: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
