# Camera Model Documentation

## Tổng quan

Model Camera được thiết kế để quản lý thông tin chi tiết về các camera giám sát trong hệ thống quản lý phương tiện. Model này hỗ trợ quản lý thông tin kỹ thuật, vị trí, cấu hình nhận diện, bảo trì và thống kê hoạt động.

## Cấu trúc Model

### Thông tin cơ bản
- `cameraId`: ID duy nhất của camera
- `name`: Tên camera 
- `description`: Mô tả chi tiết về camera

### Thông tin vị trí (`location`)
- `gateId`: ID của cổng/khu vực
- `gateName`: Tên cổng/khu vực  
- `position`: Vị trí camera (entry/exit/both)
- `coordinates`: Tọa độ GPS (latitude, longitude)

### Thông tin kỹ thuật (`technical`)
- `ipAddress`: Địa chỉ IP của camera
- `port`: Port kết nối
- `protocol`: Giao thức (http/https/rtsp/rtmp/onvif)
- `username/password`: Thông tin xác thực
- `streamUrl`: URL stream video
- `resolution`: Độ phân giải (width x height)
- `fps`: Số khung hình/giây

### Cấu hình nhận diện (`recognition`)
- `enabled`: Bật/tắt nhận diện
- `confidence.threshold`: Ngưỡng tin cậy tối thiểu
- `confidence.autoApprove`: Ngưỡng tự động duyệt
- `roi`: Vùng quan tâm (Region of Interest)
- `processingInterval`: Khoảng thời gian xử lý

### Trạng thái hoạt động (`status`)
- `isActive`: Camera có đang hoạt động
- `isOnline`: Camera có online không
- `connectionStatus`: Trạng thái kết nối
- `lastPing`: Lần ping cuối
- `lastError`: Thông tin lỗi cuối

### Thống kê (`statistics`)
- `totalDetections`: Tổng số lần phát hiện
- `successfulDetections`: Số lần phát hiện thành công
- `lastDetection`: Thời gian phát hiện cuối
- `uptime`: Thời gian hoạt động

### Bảo trì (`maintenance`)
- `lastMaintenance`: Lần bảo trì cuối
- `nextMaintenance`: Lần bảo trì tiếp theo
- `maintenanceInterval`: Chu kỳ bảo trì (ngày)
- `notes`: Ghi chú bảo trì

## API Endpoints

### Quản lý Camera

#### Lấy danh sách camera
```http
GET /api/cameras
```

Query parameters:
- `page`: Trang hiện tại (default: 1)
- `limit`: Số lượng mỗi trang (default: 20)
- `gateId`: Lọc theo cổng
- `position`: Lọc theo vị trí (entry/exit/both)
- `isActive`: Lọc camera active (true/false)
- `isOnline`: Lọc camera online (true/false)
- `connectionStatus`: Lọc theo trạng thái kết nối
- `search`: Tìm kiếm theo tên hoặc ID

#### Lấy thông tin camera
```http
GET /api/cameras/:id
```

#### Tạo camera mới
```http
POST /api/cameras
```

Body example:
```json
{
  "cameraId": "CAM-GATE-01",
  "name": "Camera Cổng Chính - Vào",
  "description": "Camera giám sát phương tiện vào cổng chính",
  "location": {
    "gateId": "GATE-01",
    "gateName": "Cổng chính",
    "position": "entry"
  },
  "technical": {
    "ipAddress": "192.168.1.101",
    "port": 80,
    "protocol": "http",
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "fps": 30
  }
}
```

#### Cập nhật camera
```http
PUT /api/cameras/:id
```

#### Xóa camera (soft delete)
```http
DELETE /api/cameras/:id
```

### Quản lý trạng thái

#### Cập nhật trạng thái kết nối
```http
PATCH /api/cameras/:id/status
```

Body:
```json
{
  "status": "connected|disconnected|error|maintenance",
  "errorInfo": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

#### Cập nhật thống kê phát hiện
```http
PATCH /api/cameras/:id/detection
```

Body:
```json
{
  "successful": true
}
```

### Bảo trì

#### Thêm ghi chú bảo trì
```http
POST /api/cameras/:id/maintenance/note
```

Body:
```json
{
  "message": "Đã kiểm tra và làm sạch ống kính"
}
```

#### Lập lịch bảo trì tiếp theo
```http
PATCH /api/cameras/:id/maintenance/schedule
```

### Truy vấn đặc biệt

#### Lấy camera theo cổng
```http
GET /api/cameras/gate/:gateId
```

#### Lấy camera cần bảo trì
```http
GET /api/cameras/maintenance
```

#### Lấy thống kê tổng quan
```http
GET /api/cameras/statistics
```

## Demo Endpoints (Không cần auth)

```http
GET /api/demo/init          # Khởi tạo dữ liệu mẫu
GET /api/demo/clear         # Xóa tất cả camera
GET /api/demo/overview      # Thống kê tổng quan
GET /api/demo/list          # Danh sách camera (10 camera đầu)
GET /api/demo/random-status # Cập nhật trạng thái ngẫu nhiên
```

## Static Methods

### `Camera.findActive(filter)`
Tìm các camera đang hoạt động

### `Camera.findOnline(filter)`
Tìm các camera đang online

### `Camera.findByGate(gateId)`
Tìm camera theo cổng

### `Camera.findNeedingMaintenance()`
Tìm camera cần bảo trì

### `Camera.getStatistics()`
Lấy thống kê tổng quan

## Instance Methods

### `camera.updateStatus(status, errorInfo)`
Cập nhật trạng thái kết nối

### `camera.incrementDetection(successful)`
Tăng số lượng phát hiện

### `camera.addMaintenanceNote(message, userId)`
Thêm ghi chú bảo trì

### `camera.scheduleNextMaintenance()`
Lập lịch bảo trì tiếp theo

## Virtual Fields

### `camera.isWarrantyValid`
Kiểm tra bảo hành còn hạn

### `camera.needsMaintenance`
Kiểm tra cần bảo trì

### `camera.detectionSuccessRate`
Tỷ lệ phát hiện thành công (%)

## Test Camera Model

Chạy test để kiểm tra các chức năng:

```bash
node test-camera.js
```

## Sử dụng với AccessLog

Camera model đã được tích hợp với AccessLog để lưu thông tin camera đã ghi nhận:

```javascript
// Trong AccessLog
{
  camera: ObjectId,  // Reference đến Camera
  deviceInfo: {
    cameraId: String,  // ID của camera
    deviceName: String,
    ipAddress: String
  }
}
```

## Permissions

- **User**: Chỉ có thể xem camera mình quản lý
- **Admin**: Có thể tạo, sửa, xóa camera, lập lịch bảo trì
- **Super Admin**: Toàn quyền

## Best Practices

1. **Unique cameraId**: Luôn sử dụng ID duy nhất cho camera
2. **IP Address**: Kiểm tra trùng lặp IP + Port khi tạo camera
3. **Regular Maintenance**: Thiết lập chu kỳ bảo trì phù hợp
4. **Status Monitoring**: Cập nhật trạng thái thường xuyên
5. **Error Handling**: Ghi log lỗi chi tiết để debug
6. **Security**: Không expose password trong API response

## Troubleshooting

### Camera không online
1. Kiểm tra IP và port
2. Kiểm tra network connectivity
3. Xem lastError để biết nguyên nhân

### Validation errors
1. Kiểm tra required fields
2. Đảm bảo IP address hợp lệ
3. ROI không vượt quá resolution

### Performance issues
1. Sử dụng indexes phù hợp
2. Limit số lượng khi query
3. Populate chỉ fields cần thiết
