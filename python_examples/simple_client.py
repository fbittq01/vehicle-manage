#!/usr/bin/env python3
"""
Simple Python WebSocket Client for License Plate Recognition
Ví dụ đơn giản để kết nối với Node.js back-end
"""

import asyncio
import websockets
import json
import random
import base64
import io
from datetime import datetime
from PIL import Image, ImageDraw
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleLicensePlateClient:
    """Client đơn giản để gửi dữ liệu nhận diện biển số"""
    
    def __init__(self, backend_url="ws://localhost:3001"):
        self.backend_url = backend_url
        self.websocket = None
        
        # Sample data
        self.sample_plates = [
            "29A-123.45", "30F-567.89", "51B-999.88", 
            "77C-456.12", "43D-789.33", "59K-888.99"
        ]
        
        self.gates = [
            {"id": "GATE_001", "name": "Cổng chính"},
            {"id": "GATE_002", "name": "Cổng phụ"},
            {"id": "GATE_003", "name": "Cổng sau"}
        ]

    async def connect(self):
        """Kết nối tới back-end server"""
        try:
            logger.info(f"Connecting to {self.backend_url}...")
            self.websocket = await websockets.connect(self.backend_url)
            logger.info("✅ Connected successfully!")
            return True
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            return False

    def create_fake_image_base64(self, text="Sample"):
        """Tạo ảnh giả dạng base64"""
        try:
            img = Image.new('RGB', (400, 300), color=(50, 50, 50))
            draw = ImageDraw.Draw(img)
            draw.text((10, 10), text, fill="white")
            
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG')
            return base64.b64encode(buffer.getvalue()).decode()
        except:
            return "fake_base64_image_data"

    def generate_detection_data(self):
        """Tạo dữ liệu nhận diện giả"""
        gate = random.choice(self.gates)
        plate = random.choice(self.sample_plates)
        
        return {
            "licensePlate": plate,
            "confidence": round(random.uniform(0.75, 0.98), 2),
            "gateId": gate["id"],
            "gateName": gate["name"],
            "action": random.choice(["entry", "exit"]),
            "processedImage": self.create_fake_image_base64(f"Processed: {plate}"),
            "originalImage": self.create_fake_image_base64("Original"),
            "boundingBox": {
                "x": random.randint(50, 200),
                "y": random.randint(50, 150),
                "width": random.randint(150, 300),
                "height": random.randint(80, 120)
            },
            "processingTime": random.randint(100, 500),
            "deviceInfo": {
                "cameraId": f"CAM_{random.randint(1, 10):03d}",
                "deviceName": f"Camera {gate['name']}",
                "ipAddress": f"192.168.1.{random.randint(100, 200)}"
            },
            "weather": {
                "condition": random.choice(["sunny", "cloudy", "rainy"]),
                "temperature": random.randint(20, 35),
                "humidity": random.randint(60, 90)
            }
        }

    async def send_detection(self, detection_data):
        """Gửi dữ liệu nhận diện"""
        message = {
            "type": "license_plate_detected",
            "data": detection_data,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            await self.websocket.send(json.dumps(message))
            logger.info(f"📤 Sent: {detection_data['licensePlate']} - {detection_data['action']} (Confidence: {detection_data['confidence']})")
            return True
        except Exception as e:
            logger.error(f"❌ Send error: {e}")
            return False

    async def send_status(self, status="processing", processed_count=0):
        """Gửi trạng thái xử lý"""
        status_data = {
            "status": status,
            "activeGates": [gate["id"] for gate in self.gates],
            "processedCount": processed_count,
            "errorCount": 0,
            "uptime": random.randint(100, 3600),
            "memoryUsage": random.uniform(50, 80),
            "cpuUsage": random.uniform(20, 60)
        }
        
        message = {
            "type": "processing_status",
            "data": status_data,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            await self.websocket.send(json.dumps(message))
            logger.info(f"📊 Sent status: {status}")
            return True
        except Exception as e:
            logger.error(f"❌ Status send error: {e}")
            return False

    async def send_error(self, error_message, severity="medium"):
        """Gửi thông báo lỗi"""
        error_data = {
            "errorCode": "PROCESSING_ERROR",
            "message": error_message,
            "severity": severity,
            "timestamp": datetime.now().isoformat(),
            "details": {
                "source": "python_client",
                "version": "1.0.0"
            }
        }
        
        message = {
            "type": "error",
            "data": error_data,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            await self.websocket.send(json.dumps(message))
            logger.warning(f"⚠️ Sent error: {error_message}")
            return True
        except Exception as e:
            logger.error(f"❌ Error send failed: {e}")
            return False

    async def simulate_processing(self, duration=60, detection_interval=5):
        """Mô phỏng xử lý nhận diện trong thời gian nhất định"""
        if not await self.connect():
            return
        
        logger.info(f"🚀 Starting simulation for {duration} seconds...")
        
        # Gửi trạng thái bắt đầu
        await self.send_status("processing", 0)
        
        start_time = asyncio.get_event_loop().time()
        processed_count = 0
        
        try:
            while asyncio.get_event_loop().time() - start_time < duration:
                # Ngẫu nhiên gửi detection hoặc error
                if random.random() < 0.1:  # 10% chance of error
                    await self.send_error("Simulated processing error", "low")
                else:
                    # Gửi detection
                    detection = self.generate_detection_data()
                    success = await self.send_detection(detection)
                    if success:
                        processed_count += 1
                
                # Gửi status update mỗi 30 giây
                if processed_count % 5 == 0 and processed_count > 0:
                    await self.send_status("processing", processed_count)
                
                # Chờ trước khi gửi detection tiếp theo
                await asyncio.sleep(random.uniform(detection_interval * 0.5, detection_interval * 1.5))
        
        except KeyboardInterrupt:
            logger.info("🛑 Simulation interrupted by user")
        
        finally:
            # Gửi trạng thái kết thúc
            await self.send_status("idle", processed_count)
            await self.disconnect()
            logger.info(f"✅ Simulation completed. Processed {processed_count} detections")

    async def disconnect(self):
        """Đóng kết nối"""
        if self.websocket:
            await self.websocket.close()
            logger.info("🔌 Disconnected from server")

    async def test_connection(self):
        """Test kết nối và gửi một detection"""
        if not await self.connect():
            return False
        
        try:
            # Test gửi detection
            detection = self.generate_detection_data()
            success = await self.send_detection(detection)
            
            if success:
                logger.info("✅ Connection test successful!")
                return True
            else:
                logger.error("❌ Failed to send detection")
                return False
                
        finally:
            await self.disconnect()


async def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Simple License Plate WebSocket Client")
    parser.add_argument("--url", default="ws://localhost:3001", help="Backend WebSocket URL")
    parser.add_argument("--mode", choices=["test", "simulate", "single"], default="simulate", 
                       help="Operation mode")
    parser.add_argument("--duration", type=int, default=60, help="Simulation duration in seconds")
    parser.add_argument("--interval", type=float, default=5.0, help="Average interval between detections")
    
    args = parser.parse_args()
    
    client = SimpleLicensePlateClient(args.url)
    
    try:
        if args.mode == "test":
            await client.test_connection()
        elif args.mode == "single":
            # Gửi một detection duy nhất
            if await client.connect():
                detection = client.generate_detection_data()
                await client.send_detection(detection)
                await client.disconnect()
        else:  # simulate
            await client.simulate_processing(args.duration, args.interval)
            
    except KeyboardInterrupt:
        logger.info("👋 Goodbye!")
    except Exception as e:
        logger.error(f"❌ Error: {e}")


if __name__ == "__main__":
    # Chạy với python simple_client.py --mode simulate --duration 120
    asyncio.run(main())
