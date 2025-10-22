import { Server } from 'socket.io';
import { createServer } from 'http';
import { AccessLog, Vehicle, User } from '../models/index.js';
import { normalizeLicensePlate, validateVietnameseLicensePlate } from '../utils/licensePlate.js';
import { processRecognitionImages } from '../utils/fileStorage.js';
import { createAccessLogLogic } from '../controllers/accessLogController.js';

class SocketService {
  constructor() {
    this.io = null;
    this.httpServer = null;
    this.pythonServerSocket = null;
    this.connectedClients = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
  }

  // Khởi tạo Socket.IO server
  initialize(app) {
    this.httpServer = createServer(app);
    this.io = new Server(this.httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
    
    // Kiểm tra environment variable để enable/disable Python server
    if (process.env.PYTHON_SERVER_ENABLED === 'true') {
      this.connectToPythonServer();
    } else {
      console.log('🚫 Python AI server connection disabled by environment variable');
    }
    
    return this.httpServer;
  }

  // Thiết lập các event handlers cho client connections
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Xác thực client (optional)
      socket.on('authenticate', async (data) => {
        try {
          // Có thể thêm logic xác thực JWT token ở đây
          this.connectedClients.set(socket.id, {
            socketId: socket.id,
            userId: data.userId,
            role: data.role,
            connectedAt: new Date()
          });
          
          socket.emit('authenticated', { success: true });
        } catch (error) {
          socket.emit('authentication_error', { error: error.message });
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
        
        if (cameraIds) {
          cameraIds.forEach(cameraId => {
            socket.join(`camera_${cameraId}`);
            
            // Gửi yêu cầu bắt đầu stream tới Python server
            this.sendToPythonServer({
              type: 'start_stream',
              data: {
                cameraId,
                clientId: socket.id,
                quality: quality || 'medium'
              }
            });
          });
        }
        
        socket.emit('camera_subscribed', { cameraIds });
      });

      // Unsubscribe từ camera stream
      socket.on('unsubscribe_camera_stream', (data) => {
        const { cameraIds } = data;
        
        if (cameraIds) {
          cameraIds.forEach(cameraId => {
            socket.leave(`camera_${cameraId}`);
            
            // Kiểm tra nếu không còn client nào subscribe camera này
            const room = this.io.sockets.adapter.rooms.get(`camera_${cameraId}`);
            if (!room || room.size === 0) {
              // Gửi yêu cầu dừng stream tới Python server
              this.sendToPythonServer({
                type: 'stop_stream',
                data: { cameraId }
              });
            }
          });
        }
        
        socket.emit('camera_unsubscribed', { cameraIds });
      });

      // Điều khiển camera (pan, tilt, zoom)
      socket.on('camera_control', (data) => {
        const { cameraId, command, value } = data;
        
        // Gửi command điều khiển tới Python server
        this.sendToPythonServer({
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
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });
  }

  // Kết nối tới Python AI server
  connectToPythonServer() {
    if (process.env.PYTHON_SERVER_ENABLED !== 'true') {
      console.log('🚫 Python AI server connection is disabled by environment');
      // Emit fake status for testing
      setTimeout(() => {
        this.io.emit('python_server_status', { 
          connected: false, 
          disabled: true,
          message: 'Python AI server connection disabled by configuration'
        });
      }, 1000);
      return;
    }
    
    const pythonServerUrl = process.env.PYTHON_SERVER_URL || 'ws://localhost:8888';
    
    try {
      // Sử dụng WebSocket client để kết nối tới Python server
      import('ws').then(({ default: WebSocket }) => {
        this.pythonServerSocket = new WebSocket(pythonServerUrl);
        
        this.pythonServerSocket.on('open', () => {
          console.log('Connected to Python AI server');
          this.reconnectAttempts = 0;
          
          // Gửi thông báo kết nối thành công tới clients
          this.io.emit('python_server_status', { connected: true });
        });

        this.pythonServerSocket.on('message', (data) => {
          this.handlePythonServerMessage(data);
        });

        this.pythonServerSocket.on('close', () => {
          console.log('Disconnected from Python AI server');
          this.io.emit('python_server_status', { connected: false });
          this.attemptReconnectToPython();
        });

        this.pythonServerSocket.on('error', (error) => {
          console.error('Python server connection error:', error);
          this.io.emit('python_server_error', { error: error.message });
        });
      });
    } catch (error) {
      console.error('Failed to import ws module:', error);
    }
  }

  // Xử lý tin nhắn từ Python server
  async handlePythonServerMessage(data) {
    try {      
      // Kiểm tra xem data có phải là JSON hợp lệ không
      const messageString = data.toString();
      if (!messageString.trim().startsWith('{') && !messageString.trim().startsWith('[')) {
        console.warn('Received non-JSON message from Python server:', messageString);
        return;
      }
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'license_plate_detected':
          await this.handleLicensePlateDetection(message.data);
          break;
          
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
          this.io.emit('processing_status', message.data);
          break;
          
        case 'error':
          this.io.emit('recognition_error', message.data);
          break;
          
        default:
          console.log('Unknown message type from Python server:', message.type);
      }
    } catch (error) {
      console.error('Error processing Python server message:', error);
    }
  }

  // Xử lý video stream từ Python server
  handleVideoStream(data) {
    console.log("🚀 ~ SocketService ~ handleVideoStream ~ data:", data)
    try {
      const { cameraId, frame, timestamp, metadata } = data;
      
      // Broadcast video frame tới clients đã subscribe camera này
      this.io.to(`camera_${cameraId}`).emit('video_frame', {
        cameraId,
        frame,
        timestamp,
        metadata
      });

      console.log(`Video frame from camera ${cameraId} broadcasted`);
    } catch (error) {
      console.error('Error handling video stream:', error);
    }
  }

  // Xử lý yêu cầu bắt đầu/dừng video stream
  handleStreamControl(data) {
    try {
      const { cameraId, action, settings } = data;
      
      // Gửi command tới Python server để điều khiển stream
      if (this.pythonServerSocket && this.pythonServerSocket.readyState === 1) {
        this.pythonServerSocket.send(JSON.stringify({
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
      
      if (!validateVietnameseLicensePlate(normalizedPlate)) {
        console.warn('Invalid license plate format:', normalizedPlate);
        this.io.emit('invalid_license_plate', { licensePlate, gateId });
        return;
      }

      // Chuẩn bị dữ liệu recognition
      const recognitionData = {
        confidence,
        processedImage,
        originalImage,
        boundingBox,
        processingTime
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

      // Gửi tới specific gate
      this.io.to(`gate_${gateId}`).emit('vehicle_detected', responseData);

      // Gửi tới admin nếu cần manual verification
      if (populatedLog.verificationStatus === 'pending') {
        this.io.emit('manual_verification_needed', responseData);
      }

      console.log(`License plate detected: ${normalizedPlate} at gate ${gateId}`);

    } catch (error) {
      console.error('Error handling license plate detection:', error);
      this.io.emit('processing_error', { error: error.message });
    }
  }

  // Gửi command tới Python server
  sendToPythonServer(message) {
    if (process.env.PYTHON_SERVER_ENABLED !== 'true') {
      console.log('🚫 Python server disabled - Command not sent:', message);
      return false;
    }
    
    if (this.pythonServerSocket && this.pythonServerSocket.readyState === 1) {
      this.pythonServerSocket.send(JSON.stringify(message));
      return true;
    }
    console.warn('Python server not connected - Command not sent:', message.type);
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

  // Thử kết nối lại Python server
  attemptReconnectToPython() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      setTimeout(() => {
        console.log(`Attempting to reconnect to Python server (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connectToPythonServer();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached for Python server');
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

  // Đóng connections
  close() {
    if (this.pythonServerSocket) {
      this.pythonServerSocket.close();
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
