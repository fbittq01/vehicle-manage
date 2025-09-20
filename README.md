# Hệ thống Quản lý Phương tiện

API backend cho hệ thống quản lý phương tiện ra vào cổng thông qua nhận diện biển số xe sử dụng Express.js, MongoDB và Socket.IO.

## Tính năng chính

### 🔐 Hệ thống xác thực & phân quyền
- **Super Admin**: Quản lý toàn hệ thống, tạo admin
- **Admin**: Quản lý users, vehicles, verify access logs
- **User**: Quản lý vehicles của bản thân, xem access logs

### 🚗 Quản lý phương tiện
- Đăng ký xe với biển số (chuẩn Việt Nam)
- Theo dõi thông tin xe: loại xe, màu sắc, bảo hiểm
- Lịch sử bảo trì
- Cảnh báo hết hạn bảo hiểm

### 📊 Theo dõi ra vào
- Nhận diện biển số tự động từ AI
- Lưu trữ lịch sử ra vào
- Tính toán thời gian lưu trú
- Hệ thống verify thủ công cho cases không chắc chắn

### 🔌 Real-time với Socket.IO
- Thông báo real-time khi có xe ra/vào
- Cảnh báo cần verify thủ công
- Kết nối với Python AI server

## Cài đặt

### Yêu cầu hệ thống
- Node.js >= 16.0.0
- MongoDB >= 4.4 (cài đặt local)
- npm hoặc yarn

### Bước 1: Cài đặt MongoDB
Cài đặt MongoDB trực tiếp trên máy:

#### macOS (sử dụng Homebrew)
```bash
# Cài đặt MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Khởi động MongoDB
brew services start mongodb/brew/mongodb-community
```

#### Ubuntu/Linux
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Thêm MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Cài đặt MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Khởi động MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Windows
Tải và cài đặt từ: https://www.mongodb.com/try/download/community

### Bước 2: Setup dự án

```bash
# Clone repository
git clone <repository-url>
cd quan-ly-phuong-tien-api

# Cài đặt dependencies
npm install

# Copy environment file
cp .env.example .env

# Khởi động server
npm run dev
```

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication

#### Đăng ký
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "user123",
  "password": "Password123!",
  "name": "Nguyen Van A",
  "phone": "0123456789",
  "department": "IT",
  "employeeId": "EMP001"
}
```

#### Đăng nhập
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user123",
  "password": "Password123!"
}
```

#### Refresh Token
```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

### Vehicles

#### Lấy danh sách xe
```http
GET /api/vehicles?page=1&limit=10&search=29A
Authorization: Bearer your_access_token
```

#### Tạo xe mới
```http
POST /api/vehicles
Authorization: Bearer your_access_token
Content-Type: application/json

{
  "licensePlate": "29A-123.45",
  "owner": "user_id",
  "vehicleType": "car",
  "brand": "Toyota",
  "model": "Camry",
  "color": "Đen",
  "year": 2020
}
```

#### Cập nhật xe
```http
PUT /api/vehicles/:id
Authorization: Bearer your_access_token
Content-Type: application/json

{
  "brand": "Honda",
  "model": "Civic"
}
```

### Access Logs

#### Tạo log mới (từ AI system)
```http
POST /api/access-logs
Content-Type: application/json

{
  "licensePlate": "29A-123.45",
  "action": "entry",
  "gateId": "GATE_001",
  "gateName": "Cổng chính",
  "recognitionData": {
    "confidence": 0.95,
    "processedImage": "base64_image_data",
    "boundingBox": {
      "x": 100,
      "y": 150,
      "width": 200,
      "height": 100
    },
    "processingTime": 250
  }
}
```

#### Verify log (Admin only)
```http
PUT /api/access-logs/:id/verify
Authorization: Bearer admin_access_token
Content-Type: application/json

{
  "status": "approved",
  "note": "Xác nhận chính xác"
}
```

#### Lấy thống kê hàng ngày
```http
GET /api/access-logs/stats/daily?date=2024-01-15
Authorization: Bearer your_access_token
```

## Socket.IO Events

### Client -> Server Events

#### Authenticate
```javascript
socket.emit('authenticate', {
  userId: 'user_id',
  role: 'admin'
});
```

#### Subscribe to updates
```javascript
socket.emit('subscribe_vehicle_updates', {
  vehicleIds: ['vehicle_id_1', 'vehicle_id_2'],
  gateIds: ['GATE_001', 'GATE_002']
});
```

### Server -> Client Events

#### Vehicle detected
```javascript
socket.on('vehicle_detected', (data) => {
  console.log('Vehicle detected:', data.accessLog);
});
```

#### Manual verification needed
```javascript
socket.on('manual_verification_needed', (data) => {
  console.log('Need manual verification:', data.accessLog);
});
```

#### Verification completed
```javascript
socket.on('verification_completed', (data) => {
  console.log('Verification completed:', data.accessLog);
});
```

## Testing với Python Client

Dự án bao gồm một Python client mẫu để test kết nối WebSocket:

```bash
# Install Python dependencies
pip install websockets requests

# Send test data to API endpoint
python3 python_client_example.py api

# Simulate WebSocket connection (khi WebSocket server sẵn sàng)
python3 python_client_example.py
```

## URLs quan trọng

Khi server chạy trên port 5000:

- **API Base**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health
- **API Documentation**: Xem file `API_DOCS.md`
- **Postman Collection**: Import file `postman_collection.json`

## Tài khoản mặc định

Khi khởi động lần đầu, hệ thống sẽ tự động tạo:

- **Super Admin**: 
  - Username: `superadmin`
  - Password: `SuperAdmin123!`

## Scripts có sẵn

```bash
npm run dev           # Start với nodemon (development)
npm start            # Start production server
npm run test:basic   # Test Node.js setup
npm run test:server  # Test server without DB
```

## Database Schema

### Users
- username, password, name, phone, role, department, employeeId
- isActive, lastLogin, refreshTokens

### Vehicles  
- licensePlate, owner, vehicleType, brand, model, color
- insurance info, maintenance history

### AccessLogs
- licensePlate, vehicle, owner, action (entry/exit)
- recognitionData (confidence, images, boundingBox)
- verificationStatus, verifiedBy, duration

## Development

### Simulation Mode (Python AI Server Disabled)

Dự án hiện tại được cấu hình để chạy ở **simulation mode** - Python AI server bị tắt để phát triển và test backend độc lập.

#### Cấu hình Simulation Mode
Trong file `.env`:
```bash
PYTHON_SERVER_ENABLED=false
```

#### API Endpoints cho Simulation

##### 1. Simulate License Plate Detection
```http
POST /api/simulation/license-plate-detection
Authorization: Bearer admin_token
Content-Type: application/json

{
  "licensePlate": "29A-123.45",
  "gateId": "gate_001",
  "gateName": "Main Gate", 
  "action": "entry"
}
```

##### 2. Test WebSocket Connection
```http
GET /api/simulation/test-websocket
Authorization: Bearer token
```

##### 3. Check Simulation Status
```http
GET /api/simulation/status
Authorization: Bearer token
```

#### Bật Python AI Server (khi sẵn sàng)
```bash
# Trong file .env
PYTHON_SERVER_ENABLED=true
PYTHON_SERVER_URL=ws://localhost:8888
```

### Scripts
```bash
# Chạy development server với nodemon
npm run dev

# Chạy production server
npm start

# Chạy tests (chưa implement)
npm test
```

### Linting & Code Style
Project sử dụng ES6+ modules và async/await pattern.

## Deployment

### Docker (recommended)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Variables for Production
- Đặt JWT_SECRET và JWT_REFRESH_SECRET mạnh
- Cấu hình MONGODB_URI cho production database
- Đặt NODE_ENV=production
- Cấu hình ALLOWED_ORIGINS cho CORS

## Monitoring & Logging

- Morgan logger cho HTTP requests
- Custom error handling middleware
- Rate limiting để bảo vệ API
- Health check endpoint: `/api/health`

## Security Features

- Helmet.js cho HTTP headers security
- JWT tokens với refresh mechanism
- Rate limiting theo endpoint
- Input validation với Joi
- Password hashing với bcrypt
- CORS configuration

## Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## License

MIT License
