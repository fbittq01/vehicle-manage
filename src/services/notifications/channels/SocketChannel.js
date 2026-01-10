/**
 * SocketChannel - Xử lý gửi notification qua WebSocket
 */
export class SocketChannel {
  constructor(socketService) {
    this.socketService = socketService;
  }

  /**
   * Gửi notification qua socket tới recipients
   * @param {Array} recipients - Danh sách recipients
   * @param {Object} notification - Notification object
   * @param {Array} rooms - Socket rooms
   */
  async send(recipients, notification, rooms = []) {
    if (!this.socketService?.io) {
      console.warn('Socket service not available');
      return;
    }

    try {
      // Gửi tới từng user cá nhân
      for (const recipient of recipients) {
        this.socketService.io.to(`user_${recipient._id}`).emit('notification', notification);
      }

      // Gửi tới rooms (để những user online nhận ngay)
      for (const room of rooms) {
        this.socketService.io.to(room).emit('notification', notification);
      }

      // Log disabled - uncomment if needed
      // console.log(`Socket sent: ${notification.title}`);
      
    } catch (error) {
      console.error('Error sending socket notification:', error);
      throw error;
    }
  }

  /**
   * Gửi broadcast notification tới tất cả clients
   * @param {Object} notification - Notification object
   */
  async broadcast(notification) {
    if (!this.socketService?.io) {
      console.warn('Socket service not available for broadcast');
      return;
    }

    try {
      this.socketService.io.emit('notification', notification);
      // Log disabled
      // console.log(`Broadcast: ${notification.title}`);
    } catch (error) {
      console.error('Error broadcasting notification:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra xem channel có sẵn sàng không
   * @returns {boolean}
   */
  isAvailable() {
    return !!(this.socketService?.io);
  }
}
