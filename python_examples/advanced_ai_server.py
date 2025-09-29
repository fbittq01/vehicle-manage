#!/usr/bin/env python3
"""
Advanced Python AI Server for License Plate Recognition
Kết nối với Node.js back-end qua WebSocket để gửi kết quả nhận diện real-time
"""

import asyncio
import websockets
import json
import cv2
import numpy as np
from datetime import datetime
import base64
import io
from PIL import Image, ImageDraw, ImageFont
import random
import logging
import signal
import sys
from typing import Optional, Dict, List, Any
import threading
import time

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class WebSocketClient:
    """WebSocket client để kết nối với Node.js back-end"""
    
    def __init__(self, server_url: str = "ws://localhost:3001"):
        self.server_url = server_url
        self.websocket = None
        self.running = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.reconnect_delay = 5  # seconds

    async def connect(self) -> bool:
        """Kết nối đến Node.js server"""
        try:
            logger.info(f"Connecting to back-end server: {self.server_url}")
            self.websocket = await websockets.connect(
                self.server_url,
                ping_interval=20,
                ping_timeout=10,
                close_timeout=10
            )
            self.running = True
            self.reconnect_attempts = 0
            logger.info("✅ Connected to back-end server successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            return False

    async def send_message(self, message_type: str, data: Dict[str, Any]) -> bool:
        """Gửi message tới back-end server"""
        if not self.websocket or self.websocket.closed:
            logger.warning("WebSocket not connected, attempting to reconnect...")
            if not await self.connect():
                return False

        message = {
            "type": message_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }

        try:
            await self.websocket.send(json.dumps(message))
            logger.debug(f"📤 Sent message type: {message_type}")
            return True
        except Exception as e:
            logger.error(f"❌ Send error: {e}")
            return False

    async def send_license_plate_detection(self, detection_data: Dict[str, Any]) -> bool:
        """Gửi kết quả nhận diện biển số"""
        return await self.send_message("license_plate_detected", detection_data)

    async def send_processing_status(self, status_data: Dict[str, Any]) -> bool:
        """Gửi trạng thái xử lý"""
        return await self.send_message("processing_status", status_data)

    async def send_error(self, error_data: Dict[str, Any]) -> bool:
        """Gửi thông báo lỗi"""
        return await self.send_message("error", error_data)

    async def listen_for_commands(self):
        """Lắng nghe commands từ back-end"""
        try:
            async for message in self.websocket:
                try:
                    command = json.loads(message)
                    logger.info(f"📥 Received command: {command.get('type')}")
                    await self.handle_command(command)
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received: {e}")
        except websockets.exceptions.ConnectionClosed:
            logger.warning("🔌 Connection closed by server")
            self.running = False
        except Exception as e:
            logger.error(f"❌ Listen error: {e}")
            self.running = False

    async def handle_command(self, command: Dict[str, Any]):
        """Xử lý commands từ back-end (có thể override trong subclass)"""
        command_type = command.get('type')
        logger.info(f"Handling command: {command_type}")
        
        # Override this method in your AI server implementation
        pass

    async def disconnect(self):
        """Đóng kết nối"""
        self.running = False
        if self.websocket and not self.websocket.closed:
            await self.websocket.close()
            logger.info("🔌 Disconnected from server")

    async def reconnect(self):
        """Thử kết nối lại"""
        if self.reconnect_attempts < self.max_reconnect_attempts:
            self.reconnect_attempts += 1
            delay = self.reconnect_delay * self.reconnect_attempts
            
            logger.info(f"Attempting to reconnect ({self.reconnect_attempts}/{self.max_reconnect_attempts}) in {delay}s...")
            await asyncio.sleep(delay)
            
            return await self.connect()
        else:
            logger.error("Max reconnection attempts reached")
            return False


class CameraManager:
    """Quản lý cameras và streams"""
    
    def __init__(self):
        self.cameras: Dict[str, Dict[str, Any]] = {}
        self.active_streams: Dict[str, cv2.VideoCapture] = {}

    def add_camera(self, camera_id: str, gate_id: str, stream_url: str, device_name: str = ""):
        """Thêm camera"""
        self.cameras[camera_id] = {
            "camera_id": camera_id,
            "gate_id": gate_id,
            "stream_url": stream_url,
            "device_name": device_name or f"Camera {camera_id}",
            "status": "inactive",
            "last_frame_time": None
        }
        logger.info(f"📷 Added camera {camera_id} for gate {gate_id}")

    async def start_camera(self, camera_id: str) -> bool:
        """Khởi động camera stream"""
        if camera_id not in self.cameras:
            logger.error(f"Camera {camera_id} not found")
            return False

        try:
            # Trong thực tế, bạn sẽ kết nối tới camera thật
            # cap = cv2.VideoCapture(self.cameras[camera_id]["stream_url"])
            
            # Simulate camera connection
            logger.info(f"📷 Starting camera {camera_id}...")
            self.cameras[camera_id]["status"] = "active"
            self.cameras[camera_id]["last_frame_time"] = datetime.now()
            
            return True
        except Exception as e:
            logger.error(f"Failed to start camera {camera_id}: {e}")
            return False

    async def stop_camera(self, camera_id: str):
        """Dừng camera stream"""
        if camera_id in self.active_streams:
            self.active_streams[camera_id].release()
            del self.active_streams[camera_id]
        
        if camera_id in self.cameras:
            self.cameras[camera_id]["status"] = "inactive"
        
        logger.info(f"📷 Stopped camera {camera_id}")

    def get_active_cameras(self) -> List[str]:
        """Lấy danh sách cameras đang hoạt động"""
        return [cam_id for cam_id, cam_info in self.cameras.items() 
                if cam_info["status"] == "active"]


class LicensePlateRecognizer:
    """Mock License Plate Recognition Engine"""
    
    def __init__(self):
        self.confidence_threshold = 0.7
        self.sample_plates = [
            "29A-123.45", "30F-567.89", "51B-999.88", "77C-456.12",
            "43D-789.33", "59K-888.99", "61H-555.44", "92B-111.22"
        ]

    async def process_frame(self, frame: np.ndarray, camera_id: str, gate_info: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Xử lý frame để nhận diện biển số"""
        try:
            # Simulate processing time
            processing_start = time.time()
            await asyncio.sleep(random.uniform(0.1, 0.3))  # Simulate AI processing
            processing_time = int((time.time() - processing_start) * 1000)

            # Simulate detection (random chance)
            if random.random() > 0.3:  # 70% chance of detection
                return None

            # Generate fake detection result
            license_plate = random.choice(self.sample_plates)
            confidence = round(random.uniform(0.75, 0.98), 2)

            if confidence < self.confidence_threshold:
                return None

            # Create processed image with bounding box
            processed_image = self.create_processed_image(frame, license_plate)
            original_image = self.frame_to_base64(frame)

            return {
                "licensePlate": license_plate,
                "confidence": confidence,
                "gateId": gate_info["gate_id"],
                "gateName": gate_info["gate_name"],
                "action": random.choice(["entry", "exit"]),
                "processedImage": processed_image,
                "originalImage": original_image,
                "boundingBox": {
                    "x": random.randint(100, 300),
                    "y": random.randint(150, 250),
                    "width": random.randint(200, 300),
                    "height": random.randint(60, 100)
                },
                "processingTime": processing_time,
                "deviceInfo": {
                    "cameraId": camera_id,
                    "deviceName": f"AI Camera {camera_id}",
                    "ipAddress": f"192.168.1.{random.randint(100, 200)}"
                },
                "weather": {
                    "condition": random.choice(["sunny", "cloudy", "rainy"]),
                    "temperature": random.randint(20, 35),
                    "humidity": random.randint(60, 90)
                }
            }

        except Exception as e:
            logger.error(f"Error processing frame: {e}")
            return None

    def create_processed_image(self, frame: np.ndarray, license_plate: str) -> str:
        """Tạo ảnh đã xử lý với bounding box"""
        try:
            # Convert frame to PIL Image
            if frame is None:
                # Create fake frame
                img = Image.new('RGB', (640, 480), color=(100, 100, 100))
            else:
                img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

            # Draw bounding box and license plate
            draw = ImageDraw.Draw(img)
            
            # Random bounding box
            x = random.randint(100, 300)
            y = random.randint(150, 250)
            width = random.randint(200, 300)
            height = random.randint(60, 100)
            
            # Draw rectangle
            draw.rectangle([x, y, x + width, y + height], outline="red", width=3)
            
            # Draw license plate text
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 16)
            except:
                font = ImageFont.load_default()
            
            draw.text((x, y - 25), license_plate, fill="red", font=font)
            
            return self.pil_to_base64(img)

        except Exception as e:
            logger.error(f"Error creating processed image: {e}")
            return self.create_fake_base64_image()

    def frame_to_base64(self, frame: np.ndarray) -> str:
        """Convert frame to base64"""
        if frame is None:
            return self.create_fake_base64_image()
        
        try:
            _, buffer = cv2.imencode('.jpg', frame)
            return base64.b64encode(buffer).decode()
        except:
            return self.create_fake_base64_image()

    def pil_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64"""
        try:
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=85)
            return base64.b64encode(buffer.getvalue()).decode()
        except:
            return self.create_fake_base64_image()

    def create_fake_base64_image(self) -> str:
        """Tạo fake base64 image"""
        img = Image.new('RGB', (640, 480), color=(128, 128, 128))
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), "Fake Camera Frame", fill="white")
        return self.pil_to_base64(img)


class LicensePlateAIServer:
    """Main AI Server class"""
    
    def __init__(self, backend_url: str = "ws://localhost:3001"):
        self.backend_url = backend_url
        self.websocket_client = WebSocketClient(backend_url)
        self.camera_manager = CameraManager()
        self.recognizer = LicensePlateRecognizer()
        self.processing = False
        self.stats = {
            "processed_count": 0,
            "error_count": 0,
            "start_time": None
        }

    async def initialize(self):
        """Khởi tạo AI server"""
        logger.info("🤖 Initializing License Plate AI Server...")
        
        # Kết nối đến back-end
        connected = await self.websocket_client.connect()
        if not connected:
            return False
        
        # Setup cameras
        await self.setup_cameras()
        
        # Setup signal handlers
        self.setup_signal_handlers()
        
        # Bắt đầu listening for commands
        asyncio.create_task(self.websocket_client.listen_for_commands())
        
        return True

    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            logger.info(f"Received signal {signum}, shutting down gracefully...")
            asyncio.create_task(self.shutdown())

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    async def setup_cameras(self):
        """Thiết lập cameras"""
        camera_configs = [
            {
                "camera_id": "CAM_001", 
                "gate_id": "GATE_001", 
                "gate_name": "Cổng chính",
                "stream_url": "rtsp://192.168.1.100:554/stream",
                "device_name": "Camera Gate 1"
            },
            {
                "camera_id": "CAM_002", 
                "gate_id": "GATE_002", 
                "gate_name": "Cổng phụ",
                "stream_url": "rtsp://192.168.1.101:554/stream",
                "device_name": "Camera Gate 2"
            },
            {
                "camera_id": "CAM_003", 
                "gate_id": "GATE_003", 
                "gate_name": "Cổng sau",
                "stream_url": "rtsp://192.168.1.102:554/stream",
                "device_name": "Camera Gate 3"
            }
        ]
        
        for config in camera_configs:
            self.camera_manager.add_camera(
                config["camera_id"], 
                config["gate_id"], 
                config["stream_url"],
                config["device_name"]
            )

    async def start_processing(self):
        """Bắt đầu xử lý nhận diện"""
        self.processing = True
        self.stats["start_time"] = datetime.now()
        
        logger.info("🚀 Starting license plate recognition...")
        
        # Khởi động tất cả cameras
        for camera_id in self.camera_manager.cameras.keys():
            await self.camera_manager.start_camera(camera_id)
        
        # Gửi status
        await self.send_status_update()
        
        # Main processing loop
        tasks = []
        for camera_id in self.camera_manager.get_active_cameras():
            task = asyncio.create_task(self.process_camera_stream(camera_id))
            tasks.append(task)
        
        # Status update task
        status_task = asyncio.create_task(self.periodic_status_update())
        tasks.append(status_task)
        
        # Wait for all tasks
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            logger.info("Processing tasks cancelled")

    async def process_camera_stream(self, camera_id: str):
        """Xử lý stream từ một camera"""
        camera_info = self.camera_manager.cameras[camera_id]
        
        logger.info(f"📷 Starting processing for camera {camera_id}")
        
        while self.processing and camera_info["status"] == "active":
            try:
                # Simulate frame capture
                fake_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                
                # Process frame
                detection = await self.recognizer.process_frame(
                    fake_frame, 
                    camera_id,
                    {
                        "gate_id": camera_info["gate_id"],
                        "gate_name": camera_info.get("device_name", f"Gate {camera_info['gate_id']}")
                    }
                )
                
                if detection:
                    success = await self.websocket_client.send_license_plate_detection(detection)
                    if success:
                        self.stats["processed_count"] += 1
                        logger.info(f"🚗 Detected: {detection['licensePlate']} at {detection['gateName']} (confidence: {detection['confidence']})")
                    else:
                        self.stats["error_count"] += 1
                
                # Wait before next frame
                await asyncio.sleep(random.uniform(3, 8))  # Random interval between detections
                
            except Exception as e:
                logger.error(f"Error processing camera {camera_id}: {e}")
                self.stats["error_count"] += 1
                await asyncio.sleep(5)
        
        logger.info(f"📷 Stopped processing camera {camera_id}")

    async def periodic_status_update(self):
        """Gửi status update định kỳ"""
        while self.processing:
            await asyncio.sleep(30)  # Update every 30 seconds
            await self.send_status_update()

    async def send_status_update(self):
        """Gửi status update"""
        uptime = 0
        if self.stats["start_time"]:
            uptime = int((datetime.now() - self.stats["start_time"]).total_seconds())

        status_data = {
            "status": "processing" if self.processing else "idle",
            "activeGates": [cam["gate_id"] for cam in self.camera_manager.cameras.values() 
                          if cam["status"] == "active"],
            "processedCount": self.stats["processed_count"],
            "errorCount": self.stats["error_count"],
            "uptime": uptime,
            "memoryUsage": random.uniform(60, 85),  # Mock data
            "cpuUsage": random.uniform(30, 60),     # Mock data
            "activeCameras": len(self.camera_manager.get_active_cameras())
        }
        
        await self.websocket_client.send_processing_status(status_data)

    async def stop_processing(self):
        """Dừng xử lý"""
        logger.info("🛑 Stopping license plate recognition...")
        self.processing = False
        
        # Stop all cameras
        for camera_id in list(self.camera_manager.cameras.keys()):
            await self.camera_manager.stop_camera(camera_id)
        
        # Send final status
        await self.send_status_update()

    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("🔄 Shutting down AI server...")
        await self.stop_processing()
        await self.websocket_client.disconnect()
        
        # Cancel all tasks
        tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        for task in tasks:
            task.cancel()
        
        logger.info("✅ AI server shutdown complete")

    async def run(self):
        """Chạy AI server"""
        try:
            # Initialize
            initialized = await self.initialize()
            if not initialized:
                logger.error("❌ Failed to initialize AI server")
                return
            
            logger.info("✅ AI Server initialized successfully")
            logger.info("🔄 Starting processing loop...")
            
            # Start processing
            await self.start_processing()
            
        except Exception as e:
            logger.error(f"❌ AI Server error: {e}")
            await self.websocket_client.send_error({
                "errorCode": "SERVER_ERROR",
                "message": str(e),
                "severity": "critical",
                "timestamp": datetime.now().isoformat()
            })
        finally:
            await self.shutdown()


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="License Plate AI Server")
    parser.add_argument("--backend", default="ws://localhost:3001", help="Backend WebSocket URL")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()
    
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create and run server
    server = LicensePlateAIServer(args.backend)
    
    try:
        asyncio.run(server.run())
    except KeyboardInterrupt:
        logger.info("👋 Goodbye!")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
