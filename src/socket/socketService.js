import { Server } from 'socket.io';
import { createServer } from 'http';
import { AccessLog, Vehicle, User } from '../models/index.js';
import { normalizeLicensePlate, validateVietnameseLicensePlate } from '../utils/licensePlate.js';
import { processRecognitionImages } from '../utils/fileStorage.js';
import { createAccessLogLogic } from '../controllers/accessLogController.js';
import { NotificationManager } from '../services/notifications/index.js';

class SocketService {
  constructor() {
    this.io = null;
    this.httpServer = null;
    this.pythonCameraSocket = null;  // WebSocket cho streaming camera (port 9000)
    this.pythonDetectionSocket = null;  // WebSocket cho detection biển số (port 8000)
    this.connectedClients = new Map();
    this.cameraReconnectAttempts = 0;
    this.detectionReconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
    this.notificationManager = null; // New notification system
  }

  // Khởi tạo Socket.IO server
  async initialize(app) {
    this.httpServer = createServer(app);
    this.io = new Server(this.httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Khởi tạo notification manager
    this.notificationManager = new NotificationManager(this);
    await this.notificationManager.initialize();

    this.setupSocketHandlers();
    // Chỉ bật periodic logging khi cần debug
    if (process.env.SOCKET_DEBUG === 'true') {
      this.startPeriodicLogging();
    }
    
    // Kiểm tra environment variable để enable/disable Python server
    if (process.env.PYTHON_SERVER_ENABLED === 'true') {
      this.connectToPythonCameraServer();
      this.connectToPythonDetectionServer();
    } else {
      console.log('🚫 Python AI servers connection disabled by environment variable');
    }
    
    return this.httpServer;
  }

  // Thiết lập các event handlers cho client connections
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      const timestamp = new Date().toISOString();
      const clientInfo = {
        id: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        origin: socket.handshake.headers.origin
      };
      
      // Log minimal khi client connect
      if (process.env.SOCKET_DEBUG === 'true') {
        console.log(`🔌 Client connected: ${socket.id}`);
      }
      
      // Xác thực client và subscribe notifications
      socket.on('authenticate', async (data) => {
        try {
          const { userId, role, departmentId, token } = data;
          
          // Debug logging (chỉ bật khi cần)
          // console.log(`🔍 Authentication: ${userId} (${role})`);
          
          // TODO: Có thể thêm logic xác thực JWT token ở đây
          // const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Lưu thông tin client
          this.connectedClients.set(socket.id, {
            socketId: socket.id,
            userId,
            role,
            departmentId,
            connectedAt: new Date()
          });
          
          // Join room theo user ID để nhận thông báo cá nhân
          socket.join(`user_${userId}`);
          
          // Join room theo role để nhận thông báo theo vai trò
          socket.join(`role_${role}`);
          
          // Join room theo department nếu có
          if (departmentId) {
            socket.join(`department_${departmentId}`);
          }
          
          // Log minimal
          if (process.env.SOCKET_DEBUG === 'true') {
            console.log(`🔐 Authenticated: ${userId} (${role})`);
          }
          
          socket.emit('authenticated', { 
            success: true,
            rooms: Array.from(socket.rooms)
          });
        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('authentication_error', { error: error.message });
        }
      });

      // Subscribe để nhận thông báo notifications
      socket.on('subscribe_notifications', async (data) => {
        try {
          const clientInfo = this.connectedClients.get(socket.id);
          if (!clientInfo) {
            socket.emit('subscription_error', { error: 'Not authenticated' });
            return;
          }

          const { types } = data; // ['working_hours_request', 'access_log_verification', etc.]
          
          // Join room theo loại thông báo
          if (types && Array.isArray(types)) {
            types.forEach(type => {
              socket.join(`notification_${type}`);
            });
          }
          
          // Cập nhật trạng thái delivered cho các notifications chưa delivered
          if (this.notificationManager) {
            try {
              await this.updateNotificationDeliveryStatus(clientInfo.userId, socket.handshake.address);
            } catch (error) {
              console.error('Error updating notification delivery status:', error);
            }
          }
          
          // Log minimal
          if (process.env.SOCKET_DEBUG === 'true') {
            console.log(`🔔 Subscribed: ${clientInfo.userId} -> ${types?.join(', ')}`);
          }
          
          socket.emit('notifications_subscribed', { types });
        } catch (error) {
          console.error('Subscription error:', error);
          socket.emit('subscription_error', { error: error.message });
        }
      });

      // Subscribe để nhận thông báo về vehicles
      socket.on('subscribe_vehicle_updates', (data) => {
        const { vehicleIds, gateIds } = data;
        
        if (vehicleIds) {
          vehicleIds.forEach(vehicleId => {
            socket.join(`vehicle_${vehicleId}`);
          });
        }
        
        if (gateIds) {
          gateIds.forEach(gateId => {
            socket.join(`gate_${gateId}`);
          });
        }
        
        socket.emit('subscribed', { vehicleIds, gateIds });
      });

      // Subscribe để nhận video stream từ camera
      socket.on('subscribe_camera_stream', (data) => {
        const { cameraIds, quality } = data;
        const timestamp = new Date().toISOString();
        
        console.log(`📹 [${timestamp}] FE subscribing to camera stream:`, {
          socketId: socket.id,
          clientIP: socket.handshake.address,
          cameraIds: cameraIds,
          quality: quality || 'medium',
          userAgent: socket.handshake.headers['user-agent']?.substring(0, 50) + '...'
        });
        
        if (cameraIds) {
          cameraIds.forEach(cameraId => {
            socket.join(`camera_${cameraId}`);
            
            console.log(`🎥 [${timestamp}] Client joined camera room:`, {
              socketId: socket.id,
              cameraId: cameraId,
              roomName: `camera_${cameraId}`,
              totalClientsInRoom: this.io.sockets.adapter.rooms.get(`camera_${cameraId}`)?.size || 1
            });
            
            // Gửi yêu cầu bắt đầu stream tới Python camera server
            this.sendToPythonCameraServer({
              type: 'start_stream',
              data: {
                cameraId,
                clientId: socket.id,
                quality: quality || 'medium'
              }
            });
            
            console.log(`🚀 [${timestamp}] Stream request sent to Python server:`, {
              cameraId: cameraId,
              clientId: socket.id,
              quality: quality || 'medium'
            });
          });
        }
        
        socket.emit('camera_subscribed', { cameraIds });
        console.log(`✅ [${timestamp}] Camera subscription confirmed for client: ${socket.id}`);
      });

      // Unsubscribe từ camera stream
      socket.on('unsubscribe_camera_stream', (data) => {
        const { cameraIds } = data;
        const timestamp = new Date().toISOString();
        
        console.log(`📹❌ [${timestamp}] FE unsubscribing from camera stream:`, {
          socketId: socket.id,
          clientIP: socket.handshake.address,
          cameraIds: cameraIds
        });
        
        if (cameraIds) {
          cameraIds.forEach(cameraId => {
            socket.leave(`camera_${cameraId}`);
            
            // Kiểm tra nếu không còn client nào subscribe camera này
            const room = this.io.sockets.adapter.rooms.get(`camera_${cameraId}`);
            const remainingClients = room?.size || 0;
            
            console.log(`🚪 [${timestamp}] Client left camera room:`, {
              socketId: socket.id,
              cameraId: cameraId,
              roomName: `camera_${cameraId}`,
              remainingClientsInRoom: remainingClients
            });
            
            if (!room || room.size === 0) {
              // Gửi yêu cầu dừng stream tới Python camera server
              this.sendToPythonCameraServer({
                type: 'stop_stream',
                data: { cameraId }
              });
              
              console.log(`⏹️ [${timestamp}] Stream stop request sent to Python server:`, {
                cameraId: cameraId,
                reason: 'No more clients subscribed'
              });
            }
          });
        }
        
        socket.emit('camera_unsubscribed', { cameraIds });
        console.log(`✅ [${timestamp}] Camera unsubscription confirmed for client: ${socket.id}`);
      });

      // Điều khiển camera (pan, tilt, zoom)
      socket.on('camera_control', (data) => {
        const { cameraId, command, value } = data;
        
        // Gửi command điều khiển tới Python camera server
        this.sendToPythonCameraServer({
          type: 'camera_control',
          data: { cameraId, command, value, clientId: socket.id }
        });
      });

      // Xử lý request manual verification
      socket.on('manual_verification_request', async (data) => {
        try {
          const { accessLogId, action } = data;
          const accessLog = await AccessLog.findById(accessLogId);
          
          if (accessLog) {
            // Broadcast tới tất cả admin/super_admin
            this.io.emit('verification_request', {
              accessLog,
              requestedBy: socket.id,
              timestamp: new Date()
            });
          }
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Xử lý disconnect
      socket.on('disconnect', (reason) => {
        const clientInfo = this.connectedClients.get(socket.id);
        
        // Log minimal khi disconnect
        if (process.env.SOCKET_DEBUG === 'true') {
          console.log(`🔌❌ Disconnected: ${clientInfo?.userId || socket.id}`);
        }
        
        // Cleanup client info
        this.connectedClients.delete(socket.id);
      });
    });
  }

  // Kết nối tới Python Camera Server (port 9000)
  connectToPythonCameraServer() {
    if (process.env.PYTHON_SERVER_ENABLED !== 'true') {
      console.log('🚫 Python Camera server connection is disabled by environment');
      return;
    }
    
    const pythonCameraServerUrl = process.env.PYTHON_CAMERA_SERVER_URL || 'ws://localhost:9000/ws';
    
    try {
      import('ws').then(({ default: WebSocket }) => {
        this.pythonCameraSocket = new WebSocket(pythonCameraServerUrl);
        
        this.pythonCameraSocket.on('open', () => {
          console.log('🎥 Connected to Python Camera Streaming server (port 9000)');
          this.cameraReconnectAttempts = 0;
          
          // Gửi thông báo kết nối thành công tới clients
          this.io.emit('python_camera_status', { connected: true });
        });

        this.pythonCameraSocket.on('message', (data) => {
          this.handlePythonCameraMessage(data);
        });

        this.pythonCameraSocket.on('close', () => {
          console.log('🎥❌ Disconnected from Python Camera server');
          this.io.emit('python_camera_status', { connected: false });
          this.attemptReconnectToPythonCamera();
        });

        this.pythonCameraSocket.on('error', (error) => {
          console.error('Python Camera server connection error:', error);
          this.io.emit('python_camera_error', { error: error.message });
        });
      });
    } catch (error) {
      console.error('Failed to import ws module for camera server:', error);
    }
  }

  // Kết nối tới Python Detection Server (port 8000)
  connectToPythonDetectionServer() {
    if (process.env.PYTHON_SERVER_ENABLED !== 'true') {
      console.log('🚫 Python Detection server connection is disabled by environment');
      return;
    }
    
    const pythonDetectionServerUrl = process.env.PYTHON_DETECTION_SERVER_URL?.replace('http://', 'ws://').replace('https://', 'wss://') || 'ws://localhost:8000/ws';
    
    try {
      import('ws').then(({ default: WebSocket }) => {
        this.pythonDetectionSocket = new WebSocket(pythonDetectionServerUrl);
        
        this.pythonDetectionSocket.on('open', () => {
          console.log('🔍 Connected to Python Detection server (port 8000)');
          this.detectionReconnectAttempts = 0;
          
          // Gửi thông báo kết nối thành công tới clients
          this.io.emit('python_detection_status', { connected: true });
        });

        this.pythonDetectionSocket.on('message', (data) => {
          this.handlePythonDetectionMessage(data);
        });

        this.pythonDetectionSocket.on('close', () => {
          console.log('🔍❌ Disconnected from Python Detection server');
          this.io.emit('python_detection_status', { connected: false });
          this.attemptReconnectToPythonDetection();
        });

        this.pythonDetectionSocket.on('error', (error) => {
          console.error('Python Detection server connection error:', error);
          this.io.emit('python_detection_error', { error: error.message });
        });
      });
    } catch (error) {
      console.error('Failed to import ws module for detection server:', error);
    }
  }

  // Xử lý tin nhắn từ Python Camera Server
  async handlePythonCameraMessage(data) {
    try {
      const messageString = data.toString();
      if (!messageString.trim().startsWith('{') && !messageString.trim().startsWith('[')) {
        console.warn('Received non-JSON message from Python Camera server:', messageString);
        return;
      }
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'video_frame':
          this.handleVideoStream(message.data);
          break;
          
        case 'stream_status':
          this.io.emit('stream_status', message.data);
          break;
          
        case 'camera_control_response':
          this.io.emit('camera_control_response', message.data);
          break;
          
        case 'processing_status':
          this.io.emit('camera_processing_status', message.data);
          break;
          
        case 'error':
          this.io.emit('camera_error', message.data);
          break;
          
        default:
          console.log('Unknown message type from Python Camera server:', message.type);
      }
    } catch (error) {
      console.error('Error processing Python Camera server message:', error);
    }
  }

  // Xử lý tin nhắn từ Python Detection Server
  async handlePythonDetectionMessage(data) {
    try {
      const messageString = data.toString();
      if (!messageString.trim().startsWith('{') && !messageString.trim().startsWith('[')) {
        // console.warn('Received non-JSON message from Python Detection server:', messageString);
        return;
      }
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'license_plate_detected':
          await this.handleLicensePlateDetection(message.data);
          break;
          
        case 'processing_status':
          this.io.emit('detection_processing_status', message.data);
          break;
          
        case 'error':
          this.io.emit('detection_error', message.data);
          break;
          
        default:
          console.log('Unknown message type from Python Detection server:', message.type);
      }
    } catch (error) {
      console.error('Error processing Python Detection server message:', error);
    }
  }

  // Xử lý video stream từ Python server
  handleVideoStream(data) {
    try {
      const { cameraId, frame, timestamp, metadata } = data;
      const currentTime = new Date().toISOString();
      
      // Lấy thông tin room để biết có bao nhiêu clients đang subscribe
      const room = this.io.sockets.adapter.rooms.get(`camera_${cameraId}`);
      const subscriberCount = room?.size || 0;
      
      if (subscriberCount > 0) {
        // Broadcast video frame tới clients đã subscribe camera này
        this.io.to(`camera_${cameraId}`).emit('video_frame', {
          cameraId,
          frame,
          timestamp,
          metadata
        });

        console.log(`📺 [${currentTime}] Video frame broadcasted:`, {
          cameraId: cameraId,
          frameSize: frame ? `${Math.round(frame.length / 1024)}KB` : 'No frame data',
          subscriberCount: subscriberCount,
          timestamp: timestamp,
          metadata: metadata
        });
      } else {
        console.log(`📺❌ [${currentTime}] No subscribers for camera ${cameraId}, frame dropped`);
      }
    } catch (error) {
      console.error('Error handling video stream:', error);
    }
  }

  // Xử lý yêu cầu bắt đầu/dừng video stream
  handleStreamControl(data) {
    try {
      const { cameraId, action, settings } = data;
      
      // Gửi command tới Python Camera server để điều khiển stream
      if (this.pythonCameraSocket && this.pythonCameraSocket.readyState === 1) {
        this.pythonCameraSocket.send(JSON.stringify({
          type: 'stream_control',
          data: { cameraId, action, settings }
        }));
      }

      // Thông báo tới clients về trạng thái stream
      this.io.to(`camera_${cameraId}`).emit('stream_status', {
        cameraId,
        action,
        timestamp: new Date().toISOString()
      });

      console.log(`Stream ${action} for camera ${cameraId}`);
    } catch (error) {
      console.error('Error handling stream control:', error);
    }
  }

  // Xử lý kết quả nhận diện biển số
  async handleLicensePlateDetection(data) {
    try {
      const {
        licensePlate,
        confidence,
        gateId,
        gateName,
        action,
        processedImage,
        originalImage,
        boundingBox,
        processingTime,
        deviceInfo,
        video
      } = data;

      // Chuẩn hóa biển số
      const normalizedPlate = normalizeLicensePlate(licensePlate);
      
      // if (!validateVietnameseLicensePlate(normalizedPlate)) {
      //   console.warn('Invalid license plate format:', normalizedPlate);
      //   this.io.emit('invalid_license_plate', { licensePlate, gateId });
      //   return;
      // }

      // Chuẩn bị dữ liệu recognition
      const recognitionData = {
        confidence,
        processedImage,
        originalImage,
        boundingBox,
        processingTime,
        video
      };

      // Chuẩn bị dữ liệu cho createAccessLogLogic
      const logData = {
        licensePlate,
        action,
        gateId,
        gateName,
        recognitionData,
        deviceInfo
      };

      // Sử dụng logic từ controller để tạo access log
      const { populatedLog, vehicle } = await createAccessLogLogic(logData);

      // Broadcast tới clients
      const responseData = {
        accessLog: populatedLog,
        vehicle,
        needsManualVerification: populatedLog.verificationStatus === 'pending'
      };

      // Gửi thông báo khi cần xác minh (xe lạ hoặc xe pending)
      try {
        if (!populatedLog.isVehicleRegistered || populatedLog.verificationStatus === 'pending') {
          await this.notifyAccessLogVerification(populatedLog);
        }
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
      }

      // Broadcast access log mới tới tất cả clients để refresh danh sách
      this.broadcast('access_log_created', {
        accessLog: populatedLog,
        timestamp: new Date()
      });

      console.log(`License plate detected: ${normalizedPlate} at gate ${gateId}`);

    } catch (error) {
      console.error('Error handling license plate detection:', error);
      this.io.emit('processing_error', { error: error.message });
    }
  }

  // Gửi command tới Python Camera Server
  sendToPythonCameraServer(message) {
    if (process.env.PYTHON_SERVER_ENABLED !== 'true') {
      console.log('🚫 Python Camera server disabled - Command not sent:', message);
      return false;
    }
    
    if (this.pythonCameraSocket && this.pythonCameraSocket.readyState === 1) {
      this.pythonCameraSocket.send(JSON.stringify(message));
      return true;
    }
    console.warn('Python Camera server not connected - Command not sent:', message.type);
    return false;
  }

  // Gửi command tới Python Detection Server
  sendToPythonDetectionServer(message) {
    if (process.env.PYTHON_SERVER_ENABLED !== 'true') {
      console.log('🚫 Python Detection server disabled - Command not sent:', message);
      return false;
    }
    
    if (this.pythonDetectionSocket && this.pythonDetectionSocket.readyState === 1) {
      this.pythonDetectionSocket.send(JSON.stringify(message));
      return true;
    }
    console.warn('Python Detection server not connected - Command not sent:', message.type);
    return false;
  }

  // Simulate license plate detection for testing (when Python server is disabled)
  simulateLicensePlateDetection(licensePlate, gateId = 'gate_001', gateName = 'Main Gate', action = 'entry') {
    const mockData = {
      licensePlate,
      confidence: 0.95,
      gateId,
      gateName,
      action,
      processedImage: null,
      originalImage: null,
      boundingBox: { x: 100, y: 100, width: 200, height: 50 },
      processingTime: 150,
      deviceInfo: {
        cameraId: 'mock_camera_001',
        deviceName: 'Simulated Camera',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log(`🎭 Simulating license plate detection: ${licensePlate}`);
    return this.handleLicensePlateDetection(mockData);
  }

  // Thử kết nối lại Python Camera server
  attemptReconnectToPythonCamera() {
    if (this.cameraReconnectAttempts < this.maxReconnectAttempts) {
      this.cameraReconnectAttempts++;
      
      setTimeout(() => {
        console.log(`Attempting to reconnect to Python Camera server (${this.cameraReconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connectToPythonCameraServer();
      }, this.reconnectDelay * this.cameraReconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached for Python Camera server');
    }
  }

  // Thử kết nối lại Python Detection server
  attemptReconnectToPythonDetection() {
    if (this.detectionReconnectAttempts < this.maxReconnectAttempts) {
      this.detectionReconnectAttempts++;
      
      setTimeout(() => {
        console.log(`Attempting to reconnect to Python Detection server (${this.detectionReconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connectToPythonDetectionServer();
      }, this.reconnectDelay * this.detectionReconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached for Python Detection server');
    }
  }

  // Broadcast message tới tất cả clients
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // Gửi message tới specific room
  sendToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
  }

  // Lấy thông tin clients đang kết nối
  getConnectedClients() {
    return Array.from(this.connectedClients.values());
  }

  // Getter cho notification manager
  getNotificationManager() {
    return this.notificationManager;
  }

  // Getter cho notification service (backward compatibility)
  getNotificationService() {
    return this.notificationManager;
  }

  // Public methods để gửi thông báo - Sử dụng NotificationManager
  async notifyWorkingHoursRequest(workingHoursRequest) {
    if (this.notificationManager) {
      await this.notificationManager.notifyWorkingHoursRequest(workingHoursRequest);
    }
  }

  async notifyVehicleVerification(accessLog, reason = 'manual_review') {
    if (this.notificationManager) {
      await this.notificationManager.notifyVehicleVerification(accessLog, reason);
    }
  }

  async notifyVehicleAccess(accessLog) {
    if (this.notificationManager) {
      await this.notificationManager.notifyVehicleAccess(accessLog);
    }
  }

  async notifyWorkingHoursRequestUpdate(workingHoursRequest, previousStatus) {
    if (this.notificationManager) {
      await this.notificationManager.notifyWorkingHoursRequestUpdate(workingHoursRequest, previousStatus);
    }
  }

  async notifyVehicleVerified(accessLog) {
    if (this.notificationManager) {
      await this.notificationManager.notifyVehicleVerified(accessLog);
    }
  }

  // Backward compatibility methods
  async notifyUnknownVehicle(accessLog) {
    if (this.notificationManager) {
      await this.notificationManager.notifyVehicleVerification(accessLog, 'unknown_vehicle');
    }
  }

  async notifyAccessLogVerification(accessLog) {
    if (this.notificationManager) {
      await this.notificationManager.notifyVehicleVerification(accessLog, 'manual_review');
    }
  }

  async notifyAccessLogVerified(accessLog) {
    if (this.notificationManager) {
      await this.notificationManager.notifyVehicleVerified(accessLog);
    }
  }

  // Cập nhật trạng thái delivered cho notifications
  async updateNotificationDeliveryStatus(userId, clientIP) {
    try {
      const { Notification } = await import('../models/index.js');
      
      // Tìm các notifications chưa delivered của user
      const pendingNotifications = await Notification.find({
        userId,
        deliveryStatus: 'sent',
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      if (pendingNotifications.length > 0) {
        // Cập nhật trạng thái delivered
        await Notification.updateMany(
          {
            userId,
            deliveryStatus: 'sent',
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: { $gt: new Date() } }
            ]
          },
          {
            deliveryStatus: 'delivered',
            deliveredAt: new Date(),
            'metadata.receiverIP': clientIP
          }
        );

        console.log(`📬 Updated ${pendingNotifications.length} notifications to delivered for user ${userId}`);
      }
    } catch (error) {
      console.error('Error updating notification delivery status:', error);
    }
  }

  // Cleanup expired notifications (có thể gọi định kỳ)
  async cleanupExpiredNotifications() {
    try {
      // Sử dụng direct database cleanup thay vì notificationService
      const { Notification } = await import('../models/index.js');
      const result = await Notification.deleteMany({
        $or: [
          { expiresAt: { $exists: true, $lt: new Date() } },
          { 
            isRead: true, 
            readAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 days ago
          }
        ]
      });
      
      console.log(`🧹 Cleaned up ${result.deletedCount} expired notifications`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      return 0;
    }
  }

  // Method để broadcast system-wide notifications
  async broadcastSystemNotification(notification) {
    try {
      // Gửi tới tất cả clients đang online
      this.io.emit('system_notification', notification);
      
      // Lưu vào database cho tất cả users active
      const { User } = await import('../models/index.js');
      const activeUsers = await User.find({ isActive: true }, '_id');
      
      if (this.notificationService) {
        for (const user of activeUsers) {
          await this.notificationService.saveNotificationToDatabase(user._id, notification);
        }
      }
      
      console.log(`📢 System notification broadcasted to ${activeUsers.length} users`);
    } catch (error) {
      console.error('Error broadcasting system notification:', error);
    }
  }

  // Method để log thống kê kết nối hiện tại
  logConnectionStats() {
    const timestamp = new Date().toISOString();
    const totalClients = this.io.sockets.sockets.size;
    const authenticatedClients = this.connectedClients.size;
    
    // Thống kê camera rooms
    const cameraRooms = new Map();
    // Thống kê notification rooms
    const notificationRooms = new Map();
    // Thống kê user/role/department rooms
    const userRooms = new Map();
    const roleRooms = new Map();
    const departmentRooms = new Map();
    // Thống kê vehicle/gate rooms
    const vehicleRooms = new Map();
    const gateRooms = new Map();
    
    this.io.sockets.adapter.rooms.forEach((sockets, roomName) => {
      if (roomName.startsWith('camera_')) {
        const cameraId = roomName.replace('camera_', '');
        cameraRooms.set(cameraId, sockets.size);
      } else if (roomName.startsWith('notification_')) {
        const notificationType = roomName.replace('notification_', '');
        notificationRooms.set(notificationType, sockets.size);
      } else if (roomName.startsWith('user_')) {
        const userId = roomName.replace('user_', '');
        userRooms.set(userId, sockets.size);
      } else if (roomName.startsWith('role_')) {
        const role = roomName.replace('role_', '');
        roleRooms.set(role, sockets.size);
      } else if (roomName.startsWith('department_')) {
        const departmentId = roomName.replace('department_', '');
        departmentRooms.set(departmentId, sockets.size);
      } else if (roomName.startsWith('vehicle_')) {
        const vehicleId = roomName.replace('vehicle_', '');
        vehicleRooms.set(vehicleId, sockets.size);
      } else if (roomName.startsWith('gate_')) {
        const gateId = roomName.replace('gate_', '');
        gateRooms.set(gateId, sockets.size);
      }
    });

    console.log(`📊 [${timestamp}] Connection Statistics:`, {
      totalClients,
      authenticatedClients,
      unauthenticatedClients: totalClients - authenticatedClients,
      activeCameraStreams: cameraRooms.size,
      cameraSubscriptions: Object.fromEntries(cameraRooms),
      notificationSubscriptions: {
        totalTypes: notificationRooms.size,
        byType: Object.fromEntries(notificationRooms)
      },
      roomSubscriptions: {
        users: Object.fromEntries(userRooms),
        roles: Object.fromEntries(roleRooms),
        departments: Object.fromEntries(departmentRooms),
        vehicles: Object.fromEntries(vehicleRooms),
        gates: Object.fromEntries(gateRooms)
      }
    });

    // Log chi tiết clients đã authenticate
    if (authenticatedClients > 0) {
      console.log(`👥 [${timestamp}] Authenticated Clients:`, 
        Array.from(this.connectedClients.values()).map(client => ({
          socketId: client.socketId,
          userId: client.userId,
          role: client.role,
          connectedFor: `${Math.round((Date.now() - client.connectedAt) / 1000)}s`
        }))
      );
    }

    // Log chi tiết notification rooms nếu có
    if (notificationRooms.size > 0) {
      console.log(`🔔 [${timestamp}] Notification Room Statistics:`, {
        totalNotificationTypes: notificationRooms.size,
        subscriptions: Object.fromEntries(
          Array.from(notificationRooms.entries()).map(([type, count]) => [
            type, 
            { subscribers: count, description: this.getNotificationTypeDescription(type) }
          ])
        )
      });
    }
  }
  
  // Helper method để mô tả các loại notification
  getNotificationTypeDescription(type) {
    const descriptions = {
      'working_hours_request': 'Yêu cầu đăng ký giờ làm việc',
      'working_hours_request_update': 'Cập nhật yêu cầu giờ làm việc',
      'vehicle_verification': 'Xe cần xác minh',
      'vehicle_verified': 'Xe đã được xác minh',
      'vehicle_access': 'Xe ra/vào',
      'access_log_verification': 'Xác thực log ra vào',
      'access_log_verified': 'Log ra vào đã xác thực',
      'unknown_vehicle_access': 'Xe lạ ra/vào',
      'system_maintenance': 'Bảo trì hệ thống',
      'emergency_alert': 'Cảnh báo khẩn cấp',
      'system_alert': 'Cảnh báo hệ thống',
      'vehicle_detection': 'Phát hiện phương tiện',
      'manual_verification': 'Xác thực thủ công',
      'working_hours_approved': 'Giờ làm việc được duyệt',
      'working_hours_rejected': 'Giờ làm việc bị từ chối',
      'access_denied': 'Từ chối truy cập',
      'security_alert': 'Cảnh báo bảo mật'
    };
    
    return descriptions[type] || 'Loại thông báo không xác định';
  }
  
  // Debug method để kiểm tra chi tiết rooms và clients
  debugRoomAndClientInfo() {
    const timestamp = new Date().toISOString();
    
    console.log(`🔧 [${timestamp}] Debug Room & Client Information:`);
    
    // Chi tiết về từng client đã authenticate
    console.log(`📋 Authenticated Clients Detail:`);
    this.connectedClients.forEach((clientInfo, socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      console.log(`  Client ${socketId}:`, {
        userId: clientInfo.userId,
        role: clientInfo.role,
        departmentId: clientInfo.departmentId,
        connectedAt: clientInfo.connectedAt,
        isConnected: !!socket,
        currentRooms: socket ? Array.from(socket.rooms) : 'Disconnected'
      });
    });
    
    // Chi tiết về role rooms
    console.log(`🎭 Role Rooms Detail:`);
    this.io.sockets.adapter.rooms.forEach((sockets, roomName) => {
      if (roomName.startsWith('role_')) {
        const role = roomName.replace('role_', '');
        const socketIds = Array.from(sockets);
        console.log(`  Room ${roomName}:`, {
          role: role,
          subscriberCount: sockets.size,
          socketIds: socketIds,
          clients: socketIds.map(socketId => {
            const clientInfo = this.connectedClients.get(socketId);
            return clientInfo ? `${clientInfo.userId}(${clientInfo.role})` : `Unknown(${socketId})`;
          })
        });
      }
    });
    
    // Kiểm tra inconsistency giữa stored role và room subscription
    console.log(`⚠️  Role Consistency Check:`);
    this.connectedClients.forEach((clientInfo, socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        const expectedRoleRoom = `role_${clientInfo.role}`;
        const isInCorrectRoleRoom = socket.rooms.has(expectedRoleRoom);
        const currentRoleRooms = Array.from(socket.rooms).filter(room => room.startsWith('role_'));
        
        if (!isInCorrectRoleRoom || currentRoleRooms.length !== 1) {
          console.log(`  ❌ INCONSISTENCY for ${socketId}:`, {
            storedRole: clientInfo.role,
            expectedRoom: expectedRoleRoom,
            isInCorrectRoom: isInCorrectRoleRoom,
            currentRoleRooms: currentRoleRooms,
            allRooms: Array.from(socket.rooms)
          });
        } else {
          console.log(`  ✅ CONSISTENT for ${socketId}: ${clientInfo.role}`);
        }
      }
    });
  }

  // Tự động log thống kê mỗi 30 giây nếu có client kết nối
  startPeriodicLogging() {
    setInterval(() => {
      if (this.io && this.io.sockets.sockets.size > 0) {
        this.logConnectionStats();
        // Gọi debug info để kiểm tra consistency
        this.debugRoomAndClientInfo();
      }
    }, 30000); // 30 seconds
  }

  // Method để manually trigger debug (có thể gọi từ API endpoint)
  triggerDebugInfo() {
    this.debugRoomAndClientInfo();
  }

  // Đóng connections
  close() {
    if (this.pythonCameraSocket) {
      this.pythonCameraSocket.close();
    }
    if (this.pythonDetectionSocket) {
      this.pythonDetectionSocket.close();
    }
    if (this.io) {
      this.io.close();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }
  }
}

export default new SocketService();
