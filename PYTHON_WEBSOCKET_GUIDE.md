# Hướng dẫn kết nối Python Server với Back-end qua WebSocket

## Tổng quan

Hệ thống hỗ trợ kết nối WebSocket giữa Python AI server (nhận diện biển số xe) và Node.js back-end server để xử lý dữ liệu real-time.

## Cấu trúc kết nối

```
Python AI Server  ←→  WebSocket  ←→  Node.js Back-end  ←→  Frontend Clients
```

## Cấu hình Back-end Server

### 1. Environment Variables (.env)

```env
# Python Server Configuration
PYTHON_SERVER_ENABLED=true
PYTHON_SERVER_URL=ws://localhost:8888

# Socket.IO Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 2. Khởi động Server với WebSocket

Server tự động khởi tạo WebSocket service khi start:

```bash
npm start
# hoặc
npm run dev
```

## Cấu hình Python Server

### 1. Cài đặt Dependencies

```bash
pip install websockets asyncio
```

### 2. Cấu trúc Python WebSocket Client

```python
#!/usr/bin/env python3
import asyncio
import websockets
import json
from datetime import datetime

class AIServerWebSocket:
    def __init__(self, server_url="ws://localhost:3001"):
        self.server_url = server_url
        self.websocket = None
        self.running = False

    async def connect(self):
        """Kết nối đến Node.js server"""
        try:
            self.websocket = await websockets.connect(self.server_url)
            self.running = True
            print(f"✅ Connected to back-end server: {self.server_url}")
            return True
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False

    async def send_license_plate_detection(self, license_plate_data):
        """Gửi kết quả nhận diện biển số"""
        if not self.websocket:
            return False

        message = {
            "type": "license_plate_detected",
            "data": license_plate_data,
            "timestamp": datetime.now().isoformat()
        }

        try:
            await self.websocket.send(json.dumps(message))
            return True
        except Exception as e:
            print(f"❌ Send error: {e}")
            return False

    async def send_processing_status(self, status_data):
        """Gửi trạng thái xử lý"""
        message = {
            "type": "processing_status",
            "data": status_data,
            "timestamp": datetime.now().isoformat()
        }

        try:
            await self.websocket.send(json.dumps(message))
            return True
        except Exception as e:
            print(f"❌ Send status error: {e}")
            return False

    async def send_error(self, error_data):
        """Gửi thông báo lỗi"""
        message = {
            "type": "error",
            "data": error_data,
            "timestamp": datetime.now().isoformat()
        }

        try:
            await self.websocket.send(json.dumps(message))
            return True
        except Exception as e:
            print(f"❌ Send error failed: {e}")
            return False

    async def listen_for_commands(self):
        """Lắng nghe commands từ back-end"""
        try:
            async for message in self.websocket:
                command = json.loads(message)
                await self.handle_command(command)
        except websockets.exceptions.ConnectionClosed:
            print("🔌 Connection closed by server")
            self.running = False
        except Exception as e:
            print(f"❌ Listen error: {e}")
            self.running = False

    async def handle_command(self, command):
        """Xử lý commands từ back-end"""
        command_type = command.get('type')
        
        if command_type == 'start_processing':
            await self.start_license_plate_processing(command.get('data'))
        elif command_type == 'stop_processing':
            await self.stop_license_plate_processing()
        elif command_type == 'update_config':
            await self.update_processing_config(command.get('data'))
        else:
            print(f"❓ Unknown command: {command_type}")

    async def start_license_plate_processing(self, config):
        """Bắt đầu xử lý nhận diện biển số"""
        print("🚀 Starting license plate processing...")
        # Implement your AI processing logic here
        pass

    async def stop_license_plate_processing(self):
        """Dừng xử lý nhận diện"""
        print("🛑 Stopping license plate processing...")
        # Implement stop logic here
        pass

    async def update_processing_config(self, config):
        """Cập nhật cấu hình xử lý"""
        print(f"⚙️ Updating config: {config}")
        # Implement config update logic here
        pass

    async def disconnect(self):
        """Đóng kết nối"""
        self.running = False
        if self.websocket:
            await self.websocket.close()
            print("🔌 Disconnected from server")
```

### 3. Message Format

#### Gửi kết quả nhận diện biển số:

```python
license_plate_data = {
    "licensePlate": "29A-123.45",           # Biển số nhận diện được
    "confidence": 0.95,                     # Độ tin cậy (0.0-1.0)
    "gateId": "GATE_001",                   # ID cổng
    "gateName": "Cổng chính",               # Tên cổng
    "action": "entry",                      # "entry" hoặc "exit"
    "processedImage": "base64_string",      # Ảnh đã xử lý (base64)
    "originalImage": "base64_string",       # Ảnh gốc (base64)
    "boundingBox": {                        # Tọa độ vùng biển số
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 80
    },
    "processingTime": 150,                  # Thời gian xử lý (ms)
    "deviceInfo": {                         # Thông tin thiết bị
        "cameraId": "CAM_001",
        "deviceName": "Camera Gate 1",
        "ipAddress": "192.168.1.100"
    },
    "weather": {                            # Thông tin thời tiết (optional)
        "condition": "sunny",               # "sunny", "cloudy", "rainy"
        "temperature": 28,                  # Nhiệt độ (°C)
        "humidity": 75                      # Độ ẩm (%)
    }
}
```

#### Gửi trạng thái xử lý:

```python
status_data = {
    "status": "processing",                 # "idle", "processing", "error"
    "activeGates": ["GATE_001", "GATE_002"], # Danh sách cổng đang hoạt động
    "processedCount": 150,                  # Số lượng xe đã xử lý
    "errorCount": 2,                        # Số lỗi
    "uptime": 3600,                         # Thời gian hoạt động (giây)
    "memoryUsage": 75.5,                   # Sử dụng RAM (%)
    "cpuUsage": 45.2                       # Sử dụng CPU (%)
}
```

#### Gửi thông báo lỗi:

```python
error_data = {
    "errorCode": "CAMERA_DISCONNECTED",     # Mã lỗi
    "message": "Camera at gate 1 disconnected", # Thông báo lỗi
    "gateId": "GATE_001",                   # ID cổng bị lỗi
    "severity": "high",                     # "low", "medium", "high", "critical"
    "timestamp": "2025-09-29T10:30:00Z",   # Thời gian xảy ra lỗi
    "details": {                            # Chi tiết lỗi
        "cameraId": "CAM_001",
        "lastResponse": "2025-09-29T10:25:00Z"
    }
}
```

### 4. Ví dụ Python Server hoàn chỉnh

```python
#!/usr/bin/env python3
import asyncio
import websockets
import json
import cv2
import numpy as np
from datetime import datetime
import base64
import io
from PIL import Image

class LicensePlateAIServer:
    def __init__(self, backend_url="ws://localhost:3001"):
        self.backend_url = backend_url
        self.websocket_client = AIServerWebSocket(backend_url)
        self.processing = False
        self.cameras = {}

    async def initialize(self):
        """Khởi tạo AI server"""
        print("🤖 Initializing License Plate AI Server...")
        
        # Kết nối đến back-end
        connected = await self.websocket_client.connect()
        if not connected:
            return False
        
        # Khởi tạo cameras
        await self.setup_cameras()
        
        # Bắt đầu listening for commands
        asyncio.create_task(self.websocket_client.listen_for_commands())
        
        return True

    async def setup_cameras(self):
        """Thiết lập cameras"""
        # Ví dụ setup cameras
        camera_configs = [
            {"id": "CAM_001", "gate_id": "GATE_001", "url": "rtsp://192.168.1.100:554/stream"},
            {"id": "CAM_002", "gate_id": "GATE_002", "url": "rtsp://192.168.1.101:554/stream"},
        ]
        
        for config in camera_configs:
            # Initialize camera connection
            # self.cameras[config["id"]] = cv2.VideoCapture(config["url"])
            print(f"📷 Camera {config['id']} initialized for gate {config['gate_id']}")

    async def start_processing(self):
        """Bắt đầu xử lý nhận diện"""
        self.processing = True
        print("🚀 Starting license plate recognition...")
        
        # Gửi status
        await self.websocket_client.send_processing_status({
            "status": "processing",
            "activeGates": ["GATE_001", "GATE_002"],
            "processedCount": 0,
            "errorCount": 0
        })
        
        # Main processing loop
        while self.processing:
            try:
                # Simulate processing
                await asyncio.sleep(5)  # Process every 5 seconds
                
                # Simulate license plate detection
                fake_detection = self.simulate_detection()
                if fake_detection:
                    await self.websocket_client.send_license_plate_detection(fake_detection)
                    
            except Exception as e:
                await self.websocket_client.send_error({
                    "errorCode": "PROCESSING_ERROR",
                    "message": str(e),
                    "severity": "medium"
                })

    def simulate_detection(self):
        """Simulate license plate detection"""
        import random
        
        sample_plates = ["29A-123.45", "30F-567.89", "51B-999.88"]
        gates = [
            {"id": "GATE_001", "name": "Cổng chính"},
            {"id": "GATE_002", "name": "Cổng phụ"}
        ]
        
        gate = random.choice(gates)
        
        return {
            "licensePlate": random.choice(sample_plates),
            "confidence": round(random.uniform(0.8, 0.99), 2),
            "gateId": gate["id"],
            "gateName": gate["name"],
            "action": random.choice(["entry", "exit"]),
            "processedImage": self.create_fake_image(),
            "originalImage": self.create_fake_image(),
            "boundingBox": {
                "x": random.randint(50, 200),
                "y": random.randint(50, 150),
                "width": random.randint(150, 300),
                "height": random.randint(80, 120)
            },
            "processingTime": random.randint(100, 500),
            "deviceInfo": {
                "cameraId": f"CAM_{random.randint(1, 3):03d}",
                "deviceName": f"Camera Gate {random.randint(1, 2)}",
                "ipAddress": f"192.168.1.{random.randint(100, 200)}"
            }
        }

    def create_fake_image(self):
        """Tạo fake base64 image data"""
        # Tạo ảnh giả lập
        img = Image.new('RGB', (640, 480), color='blue')
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        img_bytes = buffer.getvalue()
        return base64.b64encode(img_bytes).decode()

    async def stop_processing(self):
        """Dừng xử lý"""
        self.processing = False
        print("🛑 Stopping license plate recognition...")
        
        await self.websocket_client.send_processing_status({
            "status": "idle",
            "activeGates": [],
            "processedCount": 0,
            "errorCount": 0
        })

    async def run(self):
        """Chạy AI server"""
        try:
            initialized = await self.initialize()
            if not initialized:
                print("❌ Failed to initialize AI server")
                return
            
            print("✅ AI Server initialized successfully")
            print("🔄 Starting processing loop...")
            
            # Bắt đầu xử lý
            await self.start_processing()
            
        except KeyboardInterrupt:
            print("\n🛑 Shutting down AI server...")
            await self.stop_processing()
            await self.websocket_client.disconnect()
        except Exception as e:
            print(f"❌ AI Server error: {e}")
            await self.websocket_client.send_error({
                "errorCode": "SERVER_ERROR",
                "message": str(e),
                "severity": "critical"
            })

# Sử dụng
if __name__ == "__main__":
    server = LicensePlateAIServer("ws://localhost:3001")
    asyncio.run(server.run())
```

## Cách sử dụng

### 1. Khởi động Back-end Server

```bash
# Đảm bảo MongoDB đang chạy
npm run dev
# Server sẽ chạy trên port 5000, WebSocket trên port 3001
```

### 2. Khởi động Python AI Server

```bash
python ai_server.py
```

### 3. Kiểm tra kết nối

- Kiểm tra logs của back-end server
- Kiểm tra logs của Python server
- Sử dụng WebSocket client để test

## Testing & Debugging

### 1. Sử dụng Python client có sẵn

```bash
# Sử dụng client mẫu để test
python python_client_example.py

# Hoặc test API endpoint
python python_client_example.py api
```

### 2. WebSocket Debug Tools

- **Postman**: Hỗ trợ WebSocket testing
- **wscat**: Command line WebSocket client
```bash
npm install -g wscat
wscat -c ws://localhost:3001
```

### 3. Monitor connections

Back-end server cung cấp endpoint để monitor:
```bash
# Kiểm tra status
curl http://localhost:5000/api/system/status
```

## Xử lý lỗi thường gặp

### 1. Connection Refused
- Kiểm tra back-end server đã khởi động
- Kiểm tra port có đang được sử dụng
- Kiểm tra firewall settings

### 2. Message Format Error
- Đảm bảo JSON format đúng
- Kiểm tra required fields
- Validate data types

### 3. Authentication Issues
- Đảm bảo CORS được cấu hình đúng
- Kiểm tra allowed origins
- Validate token nếu có authentication

## Best Practices

1. **Reconnection Logic**: Implement auto-reconnect
2. **Error Handling**: Always handle connection errors
3. **Message Queuing**: Queue messages when disconnected
4. **Logging**: Implement comprehensive logging
5. **Performance**: Monitor memory and CPU usage
6. **Security**: Use WSS (WebSocket Secure) in production

## Production Deployment

### 1. Environment Variables

```env
PYTHON_SERVER_ENABLED=true
PYTHON_SERVER_URL=wss://ai-server.yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

### 2. SSL/TLS Configuration

```python
# Sử dụng WSS trong production
server = LicensePlateAIServer("wss://api.yourdomain.com")
```

### 3. Load Balancing

- Sử dụng multiple Python servers
- Implement load balancer
- Use Redis for shared state

---

**Lưu ý**: Hướng dẫn này dành cho development. Trong production cần thêm authentication, encryption, và monitoring.
