# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Hệ thống sử dụng JWT tokens với Bearer authentication.

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

## API Endpoints

### 🔐 Authentication

#### POST /auth/register
Đăng ký tài khoản mới

```json
{
  "username": "user123",
  "password": "Password123!",
  "name": "Nguyen Van A",
  "phone": "0123456789",
  "department": "IT",
  "employeeId": "EMP001",
  "role": "user"
}
```

#### POST /auth/login  
Đăng nhập

```json
{
  "username": "user123",
  "password": "Password123!"
}
```

#### POST /auth/refresh-token
Làm mới token

```json
{
  "refreshToken": "your_refresh_token"
}
```

#### POST /auth/logout
Đăng xuất

```json
{
  "refreshToken": "your_refresh_token"
}
```

### 👥 Users (Admin only)

#### GET /users
Lấy danh sách users
- Query params: `page`, `limit`, `role`, `isActive`, `search`

#### GET /users/:id
Lấy thông tin user theo ID

#### POST /users
Tạo user mới (same body as register)

#### PUT /users/:id
Cập nhật user

#### DELETE /users/:id
Vô hiệu hóa user

#### PUT /users/:id/activate
Kích hoạt lại user

### 🚗 Vehicles

#### GET /vehicles
Lấy danh sách vehicles
- Query params: `page`, `limit`, `vehicleType`, `isActive`, `search`, `owner`

#### GET /vehicles/my-vehicles
Lấy vehicles của user hiện tại

#### GET /vehicles/:id
Lấy thông tin vehicle theo ID

#### GET /vehicles/license-plate/:licensePlate
Tìm vehicle theo biển số

#### POST /vehicles
Tạo vehicle mới

```json
{
  "licensePlate": "29A-123.45",
  "owner": "user_id",
  "vehicleType": "car",
  "name": "Toyota Camry",
  "color": "Đen",
  "description": "Xe ô tô màu đen"
}
```

#### PUT /vehicles/:id
Cập nhật vehicle

#### DELETE /vehicles/:id
Vô hiệu hóa vehicle

### 📊 Access Logs

#### GET /access-logs
Lấy danh sách access logs
- Query params: `page`, `limit`, `action`, `verificationStatus`, `gateId`, `startDate`, `endDate`

#### POST /access-logs
Tạo access log (từ AI system)

```json
{
  "licensePlate": "29A-123.45",
  "action": "entry",
  "gateId": "GATE_001",
  "gateName": "Cổng chính",
  "recognitionData": {
    "confidence": 0.95,
    "processedImage": "base64_image",
    "boundingBox": {
      "x": 100,
      "y": 150,
      "width": 200,
      "height": 100
    },
    "processingTime": 250
  },
  "deviceInfo": {
    "cameraId": "CAM_001",
    "deviceName": "Camera Gate 1"
  }
}
```

#### PUT /access-logs/:id/verify
Verify access log (Admin only)

```json
{
  "status": "approved",
  "note": "Xác nhận chính xác",
  "guestInfo": {
    "name": "Nguyễn Văn Khách",
    "phone": "0987654321",
    "idCard": "123456789012",
    "hometown": "Hà Nội",
    "visitPurpose": "Thăm viếng khách hàng",
    "contactPerson": "Trần Thị B",
    "notes": "Ghi chú bổ sung"
  }
}
```

#### PUT /access-logs/:id/guest-info
Cập nhật thông tin khách (Admin only)

```json
{
  "guestInfo": {
    "name": "Nguyễn Văn Khách",
    "phone": "0987654321",
    "hometown": "Thành phố Hồ Chí Minh",
    "visitPurpose": "Họp hành",
    "contactPerson": "Phạm Văn C"
  }
}
```

#### GET /access-logs/guest-search
Tìm kiếm theo thông tin khách
- Query params: `search` (bắt buộc), `limit`
- Example: `/access-logs/guest-search?search=Nguyễn Văn&limit=20`

#### PUT /access-logs/:id/verify
Verify access log (Admin only)

```json
{
  "status": "approved",
  "note": "Xác nhận chính xác"
}
```

#### GET /access-logs/stats/daily
Thống kê hàng ngày
- Query params: `date`

#### GET /access-logs/vehicles-inside
Danh sách vehicles đang trong khuôn viên

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Thành công",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "username",
      "message": "Username không hợp lệ"
    }
  ]
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Thành công",
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 100,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
