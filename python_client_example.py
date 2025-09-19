#!/usr/bin/env python3
"""
Example Python client to simulate AI license plate recognition system
This simulates the Python server that sends recognition results to the Node.js API
"""

import asyncio
import websockets
import json
import random
import time
from datetime import datetime

# Fake license plates for testing
SAMPLE_PLATES = [
    "29A-123.45",
    "30F-567.89",
    "51B-999.88",
    "77C-456.12",
    "43D-789.33"
]

GATES = [
    {"id": "GATE_001", "name": "Cổng chính"},
    {"id": "GATE_002", "name": "Cổng phụ"},
    {"id": "GATE_003", "name": "Cổng sau"}
]

def generate_fake_recognition_data():
    """Generate fake license plate recognition data"""
    return {
        "type": "license_plate_detected",
        "data": {
            "licensePlate": random.choice(SAMPLE_PLATES),
            "confidence": round(random.uniform(0.7, 0.99), 2),
            "gateId": random.choice(GATES)["id"],
            "gateName": random.choice(GATES)["name"],
            "action": random.choice(["entry", "exit"]),
            "processedImage": "fake_base64_image_data",
            "originalImage": "fake_base64_original_data",
            "boundingBox": {
                "x": random.randint(50, 200),
                "y": random.randint(50, 150),
                "width": random.randint(150, 300),
                "height": random.randint(80, 120)
            },
            "processingTime": random.randint(100, 500),
            "deviceInfo": {
                "cameraId": f"CAM_{random.randint(1, 10):03d}",
                "deviceName": f"Camera Gate {random.randint(1, 3)}",
                "ipAddress": f"192.168.1.{random.randint(100, 200)}"
            },
            "weather": {
                "condition": random.choice(["sunny", "cloudy", "rainy"]),
                "temperature": random.randint(20, 35),
                "humidity": random.randint(60, 90)
            }
        },
        "timestamp": datetime.now().isoformat()
    }

async def simulate_python_ai_server():
    """Simulate Python AI server sending recognition data"""
    uri = "ws://localhost:3001"  # This would be the WebSocket endpoint
    
    print("🤖 Starting Python AI Server Simulator...")
    print(f"   Connecting to: {uri}")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected to Node.js server")
            
            while True:
                # Generate fake recognition data
                data = generate_fake_recognition_data()
                
                # Send to Node.js server
                await websocket.send(json.dumps(data))
                print(f"📤 Sent: {data['data']['licensePlate']} - {data['data']['action']} - Confidence: {data['data']['confidence']}")
                
                # Wait before sending next data
                await asyncio.sleep(random.randint(5, 15))
                
    except websockets.exceptions.ConnectionRefused:
        print("❌ Could not connect to Node.js server")
        print("   Make sure the Node.js server is running on the correct port")
    except KeyboardInterrupt:
        print("\n🛑 Stopping AI simulator...")

def send_test_data_to_api():
    """Send test data directly to API endpoint"""
    import requests
    
    api_url = "http://localhost:5000/api/access-logs"
    
    print("📡 Sending test data to API endpoint...")
    
    for i in range(5):
        fake_data = generate_fake_recognition_data()
        
        # Format for API
        payload = {
            "licensePlate": fake_data["data"]["licensePlate"],
            "action": fake_data["data"]["action"],
            "gateId": fake_data["data"]["gateId"],
            "gateName": fake_data["data"]["gateName"],
            "recognitionData": {
                "confidence": fake_data["data"]["confidence"],
                "processedImage": fake_data["data"]["processedImage"],
                "originalImage": fake_data["data"]["originalImage"],
                "boundingBox": fake_data["data"]["boundingBox"],
                "processingTime": fake_data["data"]["processingTime"]
            },
            "deviceInfo": fake_data["data"]["deviceInfo"],
            "weather": fake_data["data"]["weather"]
        }
        
        try:
            response = requests.post(api_url, json=payload)
            if response.status_code == 201:
                print(f"✅ Created log: {payload['licensePlate']} - {payload['action']}")
            else:
                print(f"❌ Error: {response.status_code} - {response.text}")
        except requests.exceptions.ConnectionError:
            print("❌ Could not connect to API. Make sure server is running on port 5000")
            break
        
        time.sleep(2)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "api":
        send_test_data_to_api()
    else:
        asyncio.run(simulate_python_ai_server())
