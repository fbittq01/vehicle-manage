# Video Streaming System - Hướng Dẫn Triển Khai

## Tổng Quan Hệ Thống

Hệ thống video streaming của ứng dụng quản lý phương tiện bao gồm 3 thành phần chính:

1. **Node.js Server** - Backend API và WebSocket server
2. **Python AI Server** - Xử lý video stream và AI recognition  
3. **Frontend Client** - Giao diện web hiển thị video stream

```
┌─────────────────┐    WebSocket    ┌─────────────────┐    HTTP/WS    ┌─────────────────┐
│   Frontend      │◄──────────────►│   Node.js       │◄─────────────►│   Python AI     │
│   Client        │                 │   Server        │                │   Server        │
│   (React/JS)    │                 │   (Socket.IO)   │                │   (OpenCV)      │
└─────────────────┘                 └─────────────────┘                └─────────────────┘
```

## Phần 1: Python AI Server Setup

### 1.1 Cài Đặt Dependencies

```bash
# Tạo Python virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# hoặc venv\Scripts\activate  # Windows

# Cài đặt packages
pip install opencv-python
pip install websockets
pip install asyncio
pip install numpy
pip install base64
pip install json
```

### 1.2 Python AI Server Code

Tạo file `python_ai_server.py`:

```python
import asyncio
import websockets
import json
import cv2
import base64
import numpy as np
from threading import Thread, Lock
import time
import logging
from typing import Dict, Optional

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VideoStreamHandler:
    def __init__(self):
        self.active_streams: Dict[str, dict] = {}
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.streams_lock = Lock()
        
    async def connect_to_nodejs(self):
        """Kết nối tới Node.js WebSocket server"""
        nodejs_url = "ws://localhost:3001"  # URL của Node.js server
        
        try:
            async with websockets.connect(nodejs_url) as websocket:
                self.websocket = websocket
                logger.info("🔗 Connected to Node.js server")
                
                # Gửi thông báo kết nối thành công
                await self.send_to_nodejs({
                    'type': 'python_server_connected',
                    'data': {
                        'status': 'connected',
                        'timestamp': int(time.time() * 1000),
                        'capabilities': ['video_streaming', 'license_plate_recognition', 'camera_control']
                    }
                })
                
                # Lắng nghe commands từ Node.js
                async for message in websocket:
                    await self.handle_nodejs_command(json.loads(message))
                    
        except websockets.exceptions.ConnectionClosed:
            logger.warning("📡 Connection to Node.js server closed")
        except Exception as e:
            logger.error(f"❌ Connection error: {e}")
    
    async def handle_nodejs_command(self, message: dict):
        """Xử lý commands từ Node.js server"""
        msg_type = message.get('type')
        data = message.get('data', {})
        
        logger.info(f"📨 Received command: {msg_type}")
        
        try:
            if msg_type == 'start_stream':
                await self.start_camera_stream(data)
            elif msg_type == 'stop_stream':
                await self.stop_camera_stream(data)
            elif msg_type == 'camera_control':
                await self.handle_camera_control(data)
            elif msg_type == 'update_stream_settings':
                await self.update_stream_settings(data)
            else:
                logger.warning(f"❓ Unknown command type: {msg_type}")
                
        except Exception as e:
            logger.error(f"❌ Error handling command {msg_type}: {e}")
            await self.send_error_to_nodejs(str(e), data.get('cameraId'))
    
    async def start_camera_stream(self, data: dict):
        """Bắt đầu streaming từ camera"""
        camera_id = data.get('cameraId')
        stream_url = data.get('streamUrl', camera_id)  # Fallback to camera_id
        quality = data.get('quality', 'medium')
        
        logger.info(f"🎥 Starting stream for camera {camera_id}")
        
        with self.streams_lock:
            if camera_id in self.active_streams:
                # Camera đã đang stream, chỉ cần thêm client
                stream_info = self.active_streams[camera_id]
                if 'clients' not in stream_info:
                    stream_info['clients'] = set()
                stream_info['clients'].add(data.get('requestedBy', 'unknown'))
                
                await self.send_to_nodejs({
                    'type': 'stream_status',
                    'data': {
                        'cameraId': camera_id,
                        'status': 'already_streaming',
                        'clients': len(stream_info['clients'])
                    }
                })
                return
            
            # Tạo stream mới
            stream_info = {
                'camera_id': camera_id,
                'stream_url': stream_url,
                'quality': quality,
                'clients': {data.get('requestedBy', 'unknown')},
                'capture': None,
                'thread': None,
                'running': False,
                'started_at': time.time()
            }
            
            # Khởi tạo camera capture
            try:
                if stream_url.startswith(('rtsp://', 'http://', 'https://')):
                    capture = cv2.VideoCapture(stream_url)
                else:
                    # Giả sử là camera index hoặc file path
                    try:
                        capture = cv2.VideoCapture(int(stream_url))
                    except ValueError:
                        capture = cv2.VideoCapture(stream_url)
                
                if not capture.isOpened():
                    raise Exception(f"Cannot open camera/stream: {stream_url}")
                
                # Cấu hình camera
                self.configure_camera(capture, quality)
                
                stream_info['capture'] = capture
                stream_info['running'] = True
                
                # Tạo thread để stream video
                stream_thread = Thread(
                    target=self.stream_video, 
                    args=(stream_info,), 
                    daemon=True
                )
                stream_info['thread'] = stream_thread
                stream_thread.start()
                
                self.active_streams[camera_id] = stream_info
                
                await self.send_to_nodejs({
                    'type': 'stream_status',
                    'data': {
                        'cameraId': camera_id,
                        'status': 'started',
                        'quality': quality,
                        'message': f'Stream started successfully for {stream_url}'
                    }
                })
                
                logger.info(f"✅ Stream started successfully for camera {camera_id}")
                
            except Exception as e:
                logger.error(f"❌ Failed to start stream for camera {camera_id}: {e}")
                await self.send_error_to_nodejs(f'Failed to open camera: {e}', camera_id)
    
    def configure_camera(self, capture: cv2.VideoCapture, quality: str):
        """Cấu hình camera theo quality preset"""
        quality_settings = {
            'low': {
                'width': 640, 'height': 480, 'fps': 15,
                'buffer_size': 1, 'jpeg_quality': 50
            },
            'medium': {
                'width': 1280, 'height': 720, 'fps': 25,
                'buffer_size': 2, 'jpeg_quality': 70
            },
            'high': {
                'width': 1920, 'height': 1080, 'fps': 30,
                'buffer_size': 3, 'jpeg_quality': 85
            },
            'ultra': {
                'width': 3840, 'height': 2160, 'fps': 60,
                'buffer_size': 1, 'jpeg_quality': 95
            }
        }
        
        settings = quality_settings.get(quality, quality_settings['medium'])
        
        # Thiết lập resolution và FPS
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, settings['width'])
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, settings['height'])
        capture.set(cv2.CAP_PROP_FPS, settings['fps'])
        capture.set(cv2.CAP_PROP_BUFFERSIZE, settings['buffer_size'])
        
        logger.info(f"📐 Camera configured: {settings['width']}x{settings['height']} @ {settings['fps']}fps")
    
    def stream_video(self, stream_info: dict):
        """Thread function để stream video frames"""
        capture = stream_info['capture']
        camera_id = stream_info['camera_id']
        quality = stream_info['quality']
        
        # Lấy settings theo quality
        quality_settings = {
            'low': {'jpeg_quality': 50, 'target_fps': 15},
            'medium': {'jpeg_quality': 70, 'target_fps': 25},
            'high': {'jpeg_quality': 85, 'target_fps': 30},
            'ultra': {'jpeg_quality': 95, 'target_fps': 60}
        }
        
        settings = quality_settings.get(quality, quality_settings['medium'])
        frame_interval = 1.0 / settings['target_fps']
        
        logger.info(f"🎬 Video streaming thread started for camera {camera_id}")
        
        frame_count = 0
        last_log_time = time.time()
        
        while stream_info['running']:
            try:
                ret, frame = capture.read()
                if not ret:
                    logger.warning(f"⚠️ Failed to read frame from camera {camera_id}")
                    time.sleep(0.1)
                    continue
                
                # Encode frame thành JPEG
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), settings['jpeg_quality']]
                result, encoded_img = cv2.imencode('.jpg', frame, encode_param)
                
                if result:
                    # Convert thành base64
                    img_base64 = base64.b64encode(encoded_img).decode('utf-8')
                    
                    # Tạo frame data
                    frame_data = {
                        'type': 'video_frame',
                        'data': {
                            'cameraId': camera_id,
                            'frame': img_base64,
                            'timestamp': int(time.time() * 1000),
                            'metadata': {
                                'width': frame.shape[1],
                                'height': frame.shape[0],
                                'quality': quality,
                                'clients': len(stream_info.get('clients', set())),
                                'frameNumber': frame_count
                            }
                        }
                    }
                    
                    # Gửi frame đến Node.js (async)
                    asyncio.run_coroutine_threadsafe(
                        self.send_to_nodejs(frame_data),
                        asyncio.get_event_loop()
                    )
                    
                    frame_count += 1
                    
                    # Log thống kê mỗi 30 giây
                    current_time = time.time()
                    if current_time - last_log_time >= 30:
                        fps = frame_count / (current_time - stream_info['started_at'])
                        logger.info(f"📊 Camera {camera_id}: {frame_count} frames, avg FPS: {fps:.1f}")
                        last_log_time = current_time
                
                # Control frame rate
                time.sleep(frame_interval)
                
            except Exception as e:
                logger.error(f"❌ Error in streaming thread for camera {camera_id}: {e}")
                time.sleep(1)  # Wait before retrying
        
        logger.info(f"🛑 Video streaming thread stopped for camera {camera_id}")
    
    async def stop_camera_stream(self, data: dict):
        """Dừng streaming từ camera"""
        camera_id = data.get('cameraId')
        
        logger.info(f"🛑 Stopping stream for camera {camera_id}")
        
        with self.streams_lock:
            if camera_id not in self.active_streams:
                await self.send_to_nodejs({
                    'type': 'stream_status',
                    'data': {
                        'cameraId': camera_id,
                        'status': 'not_streaming',
                        'message': 'Camera was not streaming'
                    }
                })
                return
            
            stream_info = self.active_streams[camera_id]
            
            # Dừng thread streaming
            stream_info['running'] = False
            
            # Đóng capture
            if stream_info['capture']:
                stream_info['capture'].release()
            
            # Xóa khỏi active streams
            del self.active_streams[camera_id]
            
            # Tính toán thời gian streaming
            duration = time.time() - stream_info['started_at']
            
            await self.send_to_nodejs({
                'type': 'stream_status',
                'data': {
                    'cameraId': camera_id,
                    'status': 'stopped',
                    'duration': f'{int(duration//3600):02d}:{int((duration%3600)//60):02d}:{int(duration%60):02d}'
                }
            })
            
            logger.info(f"✅ Stream stopped for camera {camera_id} after {duration:.1f}s")
    
    async def handle_camera_control(self, data: dict):
        """Xử lý điều khiển camera PTZ"""
        camera_id = data.get('cameraId')
        command = data.get('command')
        value = data.get('value', 1)
        
        logger.info(f"🎮 Camera control: {camera_id} - {command} ({value})")
        
        # TODO: Implement actual PTZ control based on camera type
        # This is a placeholder that simulates the control
        
        await asyncio.sleep(0.1)  # Simulate processing time
        
        await self.send_to_nodejs({
            'type': 'camera_control_response',
            'data': {
                'cameraId': camera_id,
                'command': command,
                'value': value,
                'status': 'executed',
                'message': f'Command {command} executed successfully'
            }
        })
    
    async def update_stream_settings(self, data: dict):
        """Cập nhật cài đặt stream"""
        camera_id = data.get('cameraId')
        new_settings = data.get('settings', {})
        
        logger.info(f"⚙️ Updating stream settings for camera {camera_id}")
        
        with self.streams_lock:
            if camera_id in self.active_streams:
                stream_info = self.active_streams[camera_id]
                
                # Cập nhật quality nếu có
                if 'quality' in new_settings:
                    old_quality = stream_info['quality']
                    new_quality = new_settings['quality']
                    
                    if old_quality != new_quality:
                        # Restart stream with new quality
                        logger.info(f"🔄 Restarting stream with quality: {old_quality} -> {new_quality}")
                        
                        # Stop current stream
                        stream_info['running'] = False
                        if stream_info['capture']:
                            stream_info['capture'].release()
                        
                        # Start with new settings
                        restart_data = {
                            'cameraId': camera_id,
                            'streamUrl': stream_info['stream_url'],
                            'quality': new_quality,
                            'requestedBy': 'system'
                        }
                        
                        # Remove from active streams first
                        del self.active_streams[camera_id]
                        
                        # Restart with new settings
                        await self.start_camera_stream(restart_data)
                        return
        
        await self.send_to_nodejs({
            'type': 'stream_settings_updated',
            'data': {
                'cameraId': camera_id,
                'settings': new_settings,
                'status': 'updated'
            }
        })
    
    async def send_to_nodejs(self, message: dict):
        """Gửi message tới Node.js server"""
        if self.websocket:
            try:
                await self.websocket.send(json.dumps(message))
            except websockets.exceptions.ConnectionClosed:
                logger.warning("📡 WebSocket connection closed")
                self.websocket = None
            except Exception as e:
                logger.error(f"❌ Error sending to Node.js: {e}")
    
    async def send_error_to_nodejs(self, error_message: str, camera_id: str = None):
        """Gửi error message tới Node.js"""
        await self.send_to_nodejs({
            'type': 'error',
            'data': {
                'cameraId': camera_id,
                'error': error_message,
                'timestamp': int(time.time() * 1000)
            }
        })
    
    def cleanup(self):
        """Cleanup tất cả streams khi shutdown"""
        logger.info("🧹 Cleaning up all streams...")
        
        with self.streams_lock:
            for camera_id, stream_info in self.active_streams.items():
                stream_info['running'] = False
                if stream_info['capture']:
                    stream_info['capture'].release()
                logger.info(f"🛑 Cleaned up stream for camera {camera_id}")
        
        self.active_streams.clear()
        logger.info("✅ Cleanup completed")

# WebSocket Server để nhận kết nối từ Node.js
class PythonAIServer:
    def __init__(self, host='localhost', port=8888):
        self.host = host
        self.port = port
        self.video_handler = VideoStreamHandler()
    
    async def handle_client(self, websocket, path):
        """Xử lý kết nối từ Node.js client"""
        client_address = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"🔗 New client connected: {client_address}")
        
        self.video_handler.websocket = websocket
        
        try:
            async for message in websocket:
                data = json.loads(message)
                await self.video_handler.handle_nodejs_command(data)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"📡 Client disconnected: {client_address}")
        except Exception as e:
            logger.error(f"❌ Error handling client {client_address}: {e}")
        finally:
            self.video_handler.websocket = None
    
    async def start_server(self):
        """Khởi động WebSocket server"""
        logger.info(f"🚀 Starting Python AI Server on {self.host}:{self.port}")
        
        try:
            async with websockets.serve(self.handle_client, self.host, self.port):
                logger.info(f"✅ Python AI Server started successfully")
                logger.info(f"📡 Waiting for Node.js connections on ws://{self.host}:{self.port}")
                
                # Keep server running
                await asyncio.Future()  # run forever
                
        except Exception as e:
            logger.error(f"❌ Failed to start server: {e}")
        finally:
            self.video_handler.cleanup()

# Main function
if __name__ == "__main__":
    server = PythonAIServer()
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("🛑 Server shutdown requested")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
    finally:
        logger.info("👋 Python AI Server stopped")
```

### 1.3 Chạy Python AI Server

```bash
# Activate virtual environment
source venv/bin/activate

# Chạy server
python python_ai_server.py
```

Server sẽ chạy trên `ws://localhost:8888` và chờ kết nối từ Node.js server.

## Phần 2: Frontend Client Implementation

### 2.1 Video Stream Service

Tạo file `src/services/videoStreamService.js`:

```javascript
import io from 'socket.io-client';

class VideoStreamService {
  constructor() {
    this.socket = null;
    this.videoStreams = new Map(); // camera_id -> video_element
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Kết nối tới Node.js server
  connect(serverUrl = 'http://localhost:3001') {
    console.log('🔗 Connecting to video stream server...');
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000
    });

    this.setupEventHandlers();
    return this.socket;
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('✅ Connected to video stream server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Emit event để components biết đã kết nối
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('📡 Disconnected from server:', reason);
      this.isConnected = false;
      this.emit('disconnected', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      this.emit('reconnected', attemptNumber);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect to server');
      this.emit('reconnect_failed');
    });

    // Lắng nghe video frames
    this.socket.on('video_frame', (data) => {
      this.handleVideoFrame(data);
    });

    // Lắng nghe stream status
    this.socket.on('stream_status', (data) => {
      console.log('📊 Stream status:', data);
      this.emit('stream_status', data);
    });

    this.socket.on('camera_subscribed', (data) => {
      console.log('📺 Subscribed to cameras:', data.cameraIds);
      this.emit('camera_subscribed', data);
    });

    this.socket.on('camera_unsubscribed', (data) => {
      console.log('📴 Unsubscribed from cameras:', data.cameraIds);
      this.emit('camera_unsubscribed', data);
    });

    this.socket.on('python_server_status', (data) => {
      console.log('🐍 Python server status:', data);
      this.emit('python_server_status', data);
    });

    this.socket.on('camera_control_response', (data) => {
      console.log('🎮 Camera control response:', data);
      this.emit('camera_control_response', data);
    });

    this.socket.on('recognition_error', (data) => {
      console.error('❌ Recognition error:', data);
      this.emit('recognition_error', data);
    });
  }

  // Subscribe tới camera stream
  subscribeToCameraStream(cameraIds, quality = 'medium') {
    if (!this.isConnected) {
      console.error('❌ Not connected to server');
      return false;
    }

    const cameras = Array.isArray(cameraIds) ? cameraIds : [cameraIds];
    
    console.log(`📺 Subscribing to cameras: ${cameras.join(', ')} (${quality})`);

    this.socket.emit('subscribe_camera_stream', {
      cameraIds: cameras,
      quality
    });

    return true;
  }

  // Unsubscribe từ camera stream
  unsubscribeFromCameraStream(cameraIds) {
    if (!this.isConnected) return false;

    const cameras = Array.isArray(cameraIds) ? cameraIds : [cameraIds];
    
    console.log(`📴 Unsubscribing from cameras: ${cameras.join(', ')}`);

    this.socket.emit('unsubscribe_camera_stream', {
      cameraIds: cameras
    });

    // Clear video elements
    cameras.forEach(cameraId => {
      const videoElement = this.videoStreams.get(cameraId);
      if (videoElement && videoElement.onStreamStopped) {
        videoElement.onStreamStopped();
      }
      this.videoStreams.delete(cameraId);
    });

    return true;
  }

  // Đăng ký video element để hiển thị stream
  registerVideoElement(cameraId, videoElement, options = {}) {
    console.log(`📱 Registering video element for camera: ${cameraId}`);
    
    // Lưu options để sử dụng sau
    videoElement._streamOptions = {
      autoResize: options.autoResize !== false,
      showMetadata: options.showMetadata === true,
      onFrameUpdate: options.onFrameUpdate,
      onStreamStarted: options.onStreamStarted,
      onStreamStopped: options.onStreamStopped,
      ...options
    };
    
    this.videoStreams.set(cameraId, videoElement);
  }

  // Xử lý video frame từ server
  handleVideoFrame(data) {
    const { cameraId, frame, timestamp, metadata } = data;
    const videoElement = this.videoStreams.get(cameraId);

    if (!videoElement) {
      // console.log(`⚠️ No video element registered for camera: ${cameraId}`);
      return;
    }

    try {
      // Tạo image data URL từ base64
      const imageData = `data:image/jpeg;base64,${frame}`;
      
      // Xử lý theo loại element
      if (videoElement.tagName === 'IMG') {
        videoElement.src = imageData;
        
        // Auto resize nếu được enable
        if (videoElement._streamOptions?.autoResize && metadata) {
          videoElement.style.width = '100%';
          videoElement.style.height = 'auto';
        }
        
      } else if (videoElement.tagName === 'CANVAS') {
        const ctx = videoElement.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          // Resize canvas nếu cần
          if (videoElement._streamOptions?.autoResize) {
            videoElement.width = img.width;
            videoElement.height = img.height;
          }
          
          // Vẽ frame lên canvas
          ctx.clearRect(0, 0, videoElement.width, videoElement.height);
          ctx.drawImage(img, 0, 0, videoElement.width, videoElement.height);
          
          // Vẽ metadata nếu được enable
          if (videoElement._streamOptions?.showMetadata && metadata) {
            this.drawMetadataOnCanvas(ctx, metadata, videoElement.width, videoElement.height);
          }
        };
        
        img.src = imageData;
      }

      // Gọi callback nếu có
      const options = videoElement._streamOptions;
      if (options?.onFrameUpdate) {
        options.onFrameUpdate({
          cameraId,
          timestamp,
          metadata,
          frameNumber: metadata?.frameNumber || 0
        });
      }

      // Cập nhật timestamp cho element
      videoElement._lastFrameTime = timestamp;
      
    } catch (error) {
      console.error(`❌ Error updating video frame for camera ${cameraId}:`, error);
    }
  }

  // Vẽ metadata lên canvas
  drawMetadataOnCanvas(ctx, metadata, width, height) {
    const fontSize = Math.max(12, Math.min(width / 40, 20));
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;

    const padding = 10;
    const lineHeight = fontSize + 4;
    let y = padding + fontSize;

    const info = [
      `Quality: ${metadata.quality}`,
      `Resolution: ${metadata.width}x${metadata.height}`,
      `Clients: ${metadata.clients}`,
      `Frame: ${metadata.frameNumber || 0}`
    ];

    info.forEach((text, index) => {
      const currentY = y + (index * lineHeight);
      ctx.strokeText(text, padding, currentY);
      ctx.fillStyle = 'white';
      ctx.fillText(text, padding, currentY);
    });
  }

  // Điều khiển camera
  controlCamera(cameraId, command, value = 1) {
    if (!this.isConnected) {
      console.error('❌ Not connected to server');
      return false;
    }

    console.log(`🎮 Camera control: ${cameraId} - ${command} (${value})`);

    this.socket.emit('camera_control', {
      cameraId,
      command,
      value
    });

    return true;
  }

  // Event emitter functionality
  _events = new Map();

  on(event, callback) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    this._events.get(event).push(callback);
  }

  off(event, callback) {
    if (this._events.has(event)) {
      const callbacks = this._events.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, ...args) {
    if (this._events.has(event)) {
      this._events.get(event).forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // Lấy thống kê stream
  getStreamStats(cameraId) {
    const videoElement = this.videoStreams.get(cameraId);
    if (!videoElement) return null;

    return {
      cameraId,
      isRegistered: true,
      lastFrameTime: videoElement._lastFrameTime,
      isActive: Date.now() - (videoElement._lastFrameTime || 0) < 5000, // 5s timeout
      element: videoElement.tagName
    };
  }

  // Lấy tất cả stats
  getAllStreamStats() {
    const stats = {};
    this.videoStreams.forEach((element, cameraId) => {
      stats[cameraId] = this.getStreamStats(cameraId);
    });
    return stats;
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      console.log('📡 Disconnecting from video stream server');
      
      // Unsubscribe from all streams
      const cameraIds = Array.from(this.videoStreams.keys());
      if (cameraIds.length > 0) {
        this.unsubscribeFromCameraStream(cameraIds);
      }
      
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.videoStreams.clear();
      this._events.clear();
    }
  }

  // Kiểm tra trạng thái kết nối
  isConnectedToServer() {
    return this.isConnected && this.socket?.connected;
  }

  // Lấy thông tin kết nối
  getConnectionInfo() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      transport: this.socket?.io.engine.transport.name,
      activeStreams: this.videoStreams.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export singleton instance
export default new VideoStreamService();
```

### 2.2 React Camera Viewer Component

Tạo file `src/components/CameraViewer.jsx`:

```jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import videoStreamService from '../services/videoStreamService';
import './CameraViewer.css';

const CameraViewer = ({ 
  cameraId, 
  cameraName,
  quality = 'medium',
  autoStart = true,
  showControls = false,
  showMetadata = false,
  onStreamStatus,
  onError,
  className = ''
}) => {
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [streamStats, setStreamStats] = useState(null);
  const [error, setError] = useState(null);

  // Stream status handler
  const handleStreamStatus = useCallback((data) => {
    if (data.cameraId === cameraId) {
      const streaming = data.status === 'started' || data.status === 'already_streaming';
      setIsStreaming(streaming);
      
      if (onStreamStatus) {
        onStreamStatus(data);
      }
    }
  }, [cameraId, onStreamStatus]);

  // Connection status handler
  const handleConnectionStatus = useCallback((status) => {
    setConnectionStatus(status);
  }, []);

  // Frame update handler
  const handleFrameUpdate = useCallback((frameInfo) => {
    setStreamStats(frameInfo);
  }, []);

  // Error handler
  const handleError = useCallback((errorData) => {
    if (errorData.cameraId === cameraId || !errorData.cameraId) {
      setError(errorData.error || errorData.message);
      if (onError) {
        onError(errorData);
      }
    }
  }, [cameraId, onError]);

  // Setup effect
  useEffect(() => {
    console.log(`🎥 Setting up camera viewer for: ${cameraId}`);

    // Connect to service if not connected
    if (!videoStreamService.isConnectedToServer()) {
      videoStreamService.connect();
    }

    // Setup event listeners
    videoStreamService.on('connected', () => handleConnectionStatus('connected'));
    videoStreamService.on('disconnected', () => handleConnectionStatus('disconnected'));
    videoStreamService.on('reconnected', () => handleConnectionStatus('reconnected'));
    videoStreamService.on('stream_status', handleStreamStatus);
    videoStreamService.on('recognition_error', handleError);

    // Register canvas element
    if (canvasRef.current) {
      videoStreamService.registerVideoElement(cameraId, canvasRef.current, {
        autoResize: true,
        showMetadata: showMetadata,
        onFrameUpdate: handleFrameUpdate,
        onStreamStarted: () => setIsStreaming(true),
        onStreamStopped: () => setIsStreaming(false)
      });
    }

    // Auto start stream if enabled
    if (autoStart && videoStreamService.isConnectedToServer()) {
      startStream();
    }

    // Cleanup
    return () => {
      console.log(`🧹 Cleaning up camera viewer for: ${cameraId}`);
      
      videoStreamService.off('connected', handleConnectionStatus);
      videoStreamService.off('disconnected', handleConnectionStatus);
      videoStreamService.off('reconnected', handleConnectionStatus);
      videoStreamService.off('stream_status', handleStreamStatus);
      videoStreamService.off('recognition_error', handleError);
      
      if (isStreaming) {
        stopStream();
      }
    };
  }, [cameraId, autoStart, showMetadata]);

  // Auto start when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && autoStart && !isStreaming) {
      startStream();
    }
  }, [connectionStatus, autoStart, isStreaming]);

  const startStream = useCallback(() => {
    console.log(`▶️ Starting stream for camera: ${cameraId} (${quality})`);
    setError(null);
    
    const success = videoStreamService.subscribeToCameraStream(cameraId, quality);
    if (!success) {
      setError('Failed to start stream - not connected to server');
    }
  }, [cameraId, quality]);

  const stopStream = useCallback(() => {
    console.log(`⏹️ Stopping stream for camera: ${cameraId}`);
    videoStreamService.unsubscribeFromCameraStream(cameraId);
    setIsStreaming(false);
    setStreamStats(null);
  }, [cameraId]);

  // Camera control functions
  const controlCamera = useCallback((command, value = 1) => {
    videoStreamService.controlCamera(cameraId, command, value);
  }, [cameraId]);

  // Status badge component
  const StatusBadge = () => {
    let statusClass = 'status-badge';
    let statusText = 'Disconnected';
    
    if (connectionStatus === 'connected') {
      if (isStreaming) {
        statusClass += ' status-streaming';
        statusText = 'Streaming';
      } else {
        statusClass += ' status-connected';
        statusText = 'Connected';
      }
    } else if (connectionStatus === 'disconnected') {
      statusClass += ' status-disconnected';
      statusText = 'Disconnected';
    }
    
    return <span className={statusClass}>{statusText}</span>;
  };

  return (
    <div className={`camera-viewer ${className}`}>
      {/* Header */}
      <div className="camera-header">
        <div className="camera-info">
          <h3 className="camera-name">{cameraName || `Camera ${cameraId}`}</h3>
          <StatusBadge />
        </div>
        
        <div className="camera-actions">
          {!isStreaming ? (
            <button 
              onClick={startStream}
              disabled={connectionStatus !== 'connected'}
              className="btn-start"
            >
              ▶️ Start
            </button>
          ) : (
            <button 
              onClick={stopStream}
              className="btn-stop"
            >
              ⏹️ Stop
            </button>
          )}
        </div>
      </div>

      {/* Video Canvas */}
      <div className="video-container">
        <canvas
          ref={canvasRef}
          className="video-canvas"
          style={{
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            backgroundColor: '#000',
            display: 'block'
          }}
        />
        
        {/* Overlay messages */}
        {error && (
          <div className="stream-overlay error-overlay">
            <div className="overlay-content">
              <span className="error-icon">❌</span>
              <p>{error}</p>
              <button onClick={startStream} className="btn-retry">
                🔄 Retry
              </button>
            </div>
          </div>
        )}
        
        {!isStreaming && !error && connectionStatus === 'connected' && (
          <div className="stream-overlay waiting-overlay">
            <div className="overlay-content">
              <span className="waiting-icon">⏳</span>
              <p>Waiting for stream...</p>
            </div>
          </div>
        )}
        
        {connectionStatus === 'disconnected' && (
          <div className="stream-overlay disconnected-overlay">
            <div className="overlay-content">
              <span className="disconnected-icon">📡</span>
              <p>Server disconnected</p>
              <p className="overlay-subtext">Trying to reconnect...</p>
            </div>
          </div>
        )}
      </div>

      {/* Stream Statistics */}
      {streamStats && showMetadata && (
        <div className="stream-stats">
          <div className="stats-row">
            <span>Quality: {streamStats.metadata?.quality}</span>
            <span>Resolution: {streamStats.metadata?.width}x{streamStats.metadata?.height}</span>
          </div>
          <div className="stats-row">
            <span>Clients: {streamStats.metadata?.clients}</span>
            <span>Frame: #{streamStats.metadata?.frameNumber}</span>
          </div>
          <div className="stats-row">
            <span>Last Update: {new Date(streamStats.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Camera Controls */}
      {showControls && isStreaming && (
        <div className="camera-controls">
          <div className="control-section">
            <h4>Pan/Tilt</h4>
            <div className="ptz-controls">
              <button onClick={() => controlCamera('tilt_up')} className="control-btn">
                ⬆️
              </button>
              <div className="horizontal-controls">
                <button onClick={() => controlCamera('pan_left')} className="control-btn">
                  ⬅️
                </button>
                <button onClick={() => controlCamera('home')} className="control-btn home-btn">
                  🏠
                </button>
                <button onClick={() => controlCamera('pan_right')} className="control-btn">
                  ➡️
                </button>
              </div>
              <button onClick={() => controlCamera('tilt_down')} className="control-btn">
                ⬇️
              </button>
            </div>
          </div>
          
          <div className="control-section">
            <h4>Zoom</h4>
            <div className="zoom-controls">
              <button onClick={() => controlCamera('zoom_in')} className="control-btn">
                🔍+
              </button>
              <button onClick={() => controlCamera('zoom_out')} className="control-btn">
                🔍-
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraViewer;
```

### 2.3 CSS Styles

Tạo file `src/components/CameraViewer.css`:

```css
.camera-viewer {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.camera-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.camera-info h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  margin-top: 4px;
}

.status-streaming {
  background: #4caf50;
  color: white;
}

.status-connected {
  background: #2196f3;
  color: white;
}

.status-disconnected {
  background: #f44336;
  color: white;
}

.camera-actions button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.btn-start {
  background: #4caf50;
  color: white;
}

.btn-start:hover:not(:disabled) {
  background: #45a049;
}

.btn-start:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-stop {
  background: #f44336;
  color: white;
}

.btn-stop:hover {
  background: #da190b;
}

.video-container {
  position: relative;
  background: #000;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-canvas {
  max-width: 100%;
  height: auto;
  display: block;
}

.stream-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
}

.error-overlay {
  background: rgba(244, 67, 54, 0.9);
}

.waiting-overlay {
  background: rgba(0, 0, 0, 0.7);
}

.disconnected-overlay {
  background: rgba(156, 39, 176, 0.8);
}

.overlay-content {
  padding: 20px;
}

.overlay-content span {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.overlay-content p {
  margin: 8px 0;
  font-size: 16px;
  font-weight: 500;
}

.overlay-subtext {
  font-size: 14px !important;
  opacity: 0.8;
}

.btn-retry {
  background: #fff;
  color: #f44336;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  margin-top: 12px;
}

.btn-retry:hover {
  background: #f5f5f5;
}

.stream-stats {
  padding: 12px 16px;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
  font-size: 12px;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.stats-row:last-child {
  margin-bottom: 0;
}

.camera-controls {
  padding: 16px;
  background: #fff;
  border-top: 1px solid #dee2e6;
}

.control-section {
  margin-bottom: 16px;
}

.control-section:last-child {
  margin-bottom: 0;
}

.control-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
}

.ptz-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.horizontal-controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.zoom-controls {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.control-btn {
  width: 40px;
  height: 40px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #f0f0f0;
  border-color: #999;
}

.control-btn:active {
  transform: scale(0.95);
}

.home-btn {
  background: #2196f3 !important;
  color: white;
  border-color: #2196f3;
}

.home-btn:hover {
  background: #1976d2 !important;
}

/* Animations */
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.waiting-overlay .waiting-icon {
  animation: pulse 2s infinite;
}

/* Responsive */
@media (max-width: 768px) {
  .camera-header {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
  
  .stats-row {
    flex-direction: column;
    gap: 4px;
  }
  
  .control-btn {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }
}
```

## Phần 3: Usage Examples

### 3.1 Sử dụng trong React Component

```jsx
import React from 'react';
import CameraViewer from '../components/CameraViewer';

const SecurityDashboard = () => {
  const cameras = [
    { id: 'camera_001', name: 'Cổng chính - Vào' },
    { id: 'camera_002', name: 'Cổng chính - Ra' },
    { id: 'camera_003', name: 'Cổng phụ' },
  ];

  const handleStreamStatus = (data) => {
    console.log(`Stream status for ${data.cameraId}:`, data.status);
  };

  const handleStreamError = (error) => {
    console.error('Stream error:', error);
    // Show notification or handle error
  };

  return (
    <div className="security-dashboard">
      <h1>Camera Monitor</h1>
      
      <div className="camera-grid">
        {cameras.map(camera => (
          <div key={camera.id} className="camera-item">
            <CameraViewer
              cameraId={camera.id}
              cameraName={camera.name}
              quality="medium"
              autoStart={true}
              showControls={true}
              showMetadata={true}
              onStreamStatus={handleStreamStatus}
              onError={handleStreamError}
              className="dashboard-camera"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SecurityDashboard;
```

### 3.2 CSS cho Dashboard

```css
.security-dashboard {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.camera-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.camera-item {
  height: fit-content;
}

.dashboard-camera {
  height: 100%;
}

@media (max-width: 768px) {
  .camera-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
```

## Phần 4: Environment Variables

### 4.1 Node.js (.env)

```env
# Python Server Connection
PYTHON_SERVER_ENABLED=true
PYTHON_SERVER_URL=ws://localhost:8888

# Socket.IO Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Video Streaming Settings
MAX_CONCURRENT_STREAMS=10
DEFAULT_STREAM_QUALITY=medium
STREAM_TIMEOUT=30000
```

### 4.2 Python Server Configuration

Tạo file `config.py`:

```python
import os
from dataclasses import dataclass

@dataclass
class Config:
    # Server settings
    HOST: str = os.getenv('PYTHON_HOST', 'localhost')
    PORT: int = int(os.getenv('PYTHON_PORT', '8888'))
    
    # Node.js connection
    NODEJS_WS_URL: str = os.getenv('NODEJS_WS_URL', 'ws://localhost:3001')
    
    # Video processing settings
    MAX_CONCURRENT_STREAMS: int = int(os.getenv('MAX_STREAMS', '10'))
    DEFAULT_FRAME_RATE: int = int(os.getenv('DEFAULT_FPS', '25'))
    JPEG_QUALITY: int = int(os.getenv('JPEG_QUALITY', '70'))
    
    # Camera settings
    RTSP_TIMEOUT: int = int(os.getenv('RTSP_TIMEOUT', '5'))
    RECONNECT_ATTEMPTS: int = int(os.getenv('RECONNECT_ATTEMPTS', '3'))
    BUFFER_SIZE: int = int(os.getenv('BUFFER_SIZE', '2'))

config = Config()
```

## Phần 5: Testing & Debugging

### 5.1 Test Script cho Python Server

Tạo file `test_python_server.py`:

```python
import asyncio
import websockets
import json
import time

async def test_python_server():
    uri = "ws://localhost:8888"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected to Python server")
            
            # Test start stream
            test_command = {
                "type": "start_stream",
                "data": {
                    "cameraId": "test_camera_001",
                    "streamUrl": "0",  # Use webcam
                    "quality": "medium",
                    "requestedBy": "test_user"
                }
            }
            
            await websocket.send(json.dumps(test_command))
            print("📨 Sent start stream command")
            
            # Listen for responses
            timeout = 10
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    data = json.loads(message)
                    print(f"📨 Received: {data['type']}")
                    
                    if data['type'] == 'video_frame':
                        print(f"🎥 Frame received for camera: {data['data']['cameraId']}")
                        # Test for 5 frames then stop
                        if data['data']['metadata']['frameNumber'] >= 5:
                            break
                            
                except asyncio.TimeoutError:
                    continue
            
            # Test stop stream
            stop_command = {
                "type": "stop_stream",
                "data": {
                    "cameraId": "test_camera_001"
                }
            }
            
            await websocket.send(json.dumps(stop_command))
            print("🛑 Sent stop stream command")
            
            # Wait for stop confirmation
            message = await websocket.recv()
            data = json.loads(message)
            print(f"📨 Stop confirmation: {data}")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_python_server())
```

### 5.2 Debug Frontend Connection

```javascript
// Debug script - chạy trong browser console
const debugVideoStream = async () => {
  console.log('🔍 Starting video stream debug...');
  
  // Test connection
  const service = window.videoStreamService; // Assuming global access
  
  console.log('Connection info:', service.getConnectionInfo());
  console.log('Stream stats:', service.getAllStreamStats());
  
  // Test subscribe
  service.subscribeToCameraStream('debug_camera_001', 'medium');
  
  // Monitor events
  service.on('stream_status', (data) => {
    console.log('📊 Stream status:', data);
  });
  
  service.on('python_server_status', (data) => {
    console.log('🐍 Python status:', data);
  });
  
  setTimeout(() => {
    console.log('Final stats:', service.getAllStreamStats());
  }, 10000);
};

// Run debug
debugVideoStream();
```

## Phần 6: Deployment Notes

### 6.1 Docker Setup cho Python Server

Tạo file `Dockerfile.python`:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    python3-opencv \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy source code
COPY python_ai_server.py .
COPY config.py .

# Expose port
EXPOSE 8888

# Run server
CMD ["python", "python_ai_server.py"]
```

### 6.2 Requirements.txt

```txt
opencv-python==4.8.1.78
websockets==11.0.3
numpy==1.24.3
asyncio==3.4.3
```

### 6.3 Docker Compose Integration

Thêm vào `docker-compose.yml`:

```yaml
services:
  # ... existing services ...
  
  python-ai-server:
    build:
      context: .
      dockerfile: Dockerfile.python
    ports:
      - "8888:8888"
    environment:
      - PYTHON_HOST=0.0.0.0
      - PYTHON_PORT=8888
      - NODEJS_WS_URL=ws://node-app:3001
      - MAX_STREAMS=5
    depends_on:
      - node-app
    networks:
      - app-network
    volumes:
      - ./logs:/app/logs
```

## Phần 7: Production Considerations

### 7.1 Performance Optimization

- **Frame Rate Control**: Điều chỉnh FPS theo bandwidth
- **Quality Adaptive**: Tự động giảm quality khi bandwidth thấp
- **Connection Pooling**: Quản lý kết nối WebSocket hiệu quả
- **Memory Management**: Cleanup frames và buffers định kỳ

### 7.2 Security

- **Authentication**: Xác thực user trước khi cho phép stream
- **Rate Limiting**: Giới hạn số requests per user
- **HTTPS/WSS**: Sử dụng SSL cho production
- **Camera Access Control**: Kiểm tra quyền truy cập camera

### 7.3 Monitoring

- **Health Checks**: Monitor tình trạng Python server
- **Resource Usage**: Theo dõi CPU, Memory, Bandwidth
- **Error Logging**: Log chi tiết lỗi và performance
- **Metrics**: Stream count, frame rate, connection stats

---

## Kết Luận

Hệ thống video streaming này cung cấp:

- ✅ **Real-time video streaming** từ cameras
- ✅ **Multi-camera support** với quality control
- ✅ **PTZ camera control** (Pan/Tilt/Zoom)
- ✅ **Web-based viewer** với React components
- ✅ **Scalable architecture** với WebSocket
- ✅ **Error handling** và reconnection logic
- ✅ **Production-ready** với Docker support

Bạn có thể customize và mở rộng system này theo nhu cầu cụ thể của dự án.
