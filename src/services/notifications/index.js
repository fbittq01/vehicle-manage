/**
 * Notifications Module - Export tất cả components
 */

export { NotificationManager } from './NotificationManager.js';
export { AudienceResolver } from './handlers/AudienceResolver.js';
export { MessageBuilder } from './handlers/MessageBuilder.js';
export { SocketChannel } from './channels/SocketChannel.js';
export { DatabaseChannel } from './channels/DatabaseChannel.js';
export { 
  NOTIFICATION_TYPES, 
  PRIORITY_LEVELS, 
  AUDIENCE_TYPES,
  TEMPLATE_HELPERS 
} from './configs/notificationTypes.js';

// Default export là NotificationManager
export { NotificationManager as default } from './NotificationManager.js';
