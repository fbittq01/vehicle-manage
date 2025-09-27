# Working Hours Request API Documentation

## Tổng quan
Tính năng đăng ký ra/vào giờ hành chính cho phép người dùng tạo yêu cầu được phê duyệt để ra/vào ngoài giờ quy định mà không bị tính là vi phạm.

## Endpoints

### 1. Tạo yêu cầu đăng ký
```http
POST /api/working-hours-requests/
```

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "requestType": "entry", // "entry", "exit", "both"
  "plannedDateTime": "2025-09-28T07:30:00.000Z",
  "plannedEndDateTime": "2025-09-28T18:30:00.000Z", // chỉ cần khi requestType = "both"
  "licensePlate": "29A-123.45",
  "reason": "Có việc khẩn cấp cần đến sớm để chuẩn bị họp với khách hàng",
  "requestedBy": "670123456789abcdef012346", // optional - chỉ admin mới có thể dùng để tạo request thay mặt user khác trong cùng department
  "metadata": {
    "emergencyContact": "0912345678",
    "vehicleInfo": "Xe Honda City màu trắng"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Tạo yêu cầu đăng ký thành công",
  "data": {
    "request": {
      "_id": "670123456789abcdef012345",
      "requestedBy": {
        "_id": "670123456789abcdef012346",
        "name": "Nguyen Van A",
        "username": "nguyenvana",
        "employeeId": "NV001",
        "department": "IT",
        "phone": "0987654321"
      },
      "requestType": "entry",
      "plannedDateTime": "2025-09-28T07:30:00.000Z",
      "licensePlate": "29A12345",
      "reason": "Có việc khẩn cấp cần đến sớm để chuẩn bị họp với khách hàng",
      "status": "pending",
      "metadata": {
        "department": "IT",
        "phoneNumber": "0987654321",
        "emergencyContact": "0912345678",
        "vehicleInfo": "Xe Honda City màu trắng"
      },
      "createdAt": "2025-09-27T10:00:00.000Z",
      "updatedAt": "2025-09-27T10:00:00.000Z"
    }
  }
}
```

### 2. Lấy danh sách yêu cầu của user
```http
GET /api/working-hours-requests/my-requests
```

**Query Parameters:**
- `page` (optional): Số trang, mặc định 1
- `limit` (optional): Số bản ghi mỗi trang, mặc định 20
- `status` (optional): "pending", "approved", "rejected", "expired", "used"
- `requestType` (optional): "entry", "exit", "both"
- `startDate` (optional): Lọc theo ngày bắt đầu
- `endDate` (optional): Lọc theo ngày kết thúc

### 3. Cập nhật yêu cầu (chỉ khi đang pending)
```http
PUT /api/working-hours-requests/{id}
```

**Request Body:**
```json
{
  "plannedDateTime": "2025-09-28T08:00:00.000Z",
  "reason": "Cập nhật lý do: Cần đến sớm để chuẩn bị presentation"
}
```

### 4. Hủy yêu cầu
```http
DELETE /api/working-hours-requests/{id}
```

### 5. Lấy thông tin chi tiết yêu cầu
```http
GET /api/working-hours-requests/{id}
```

## Admin Endpoints

### 1. Lấy tất cả yêu cầu (Admin)
```http
GET /api/working-hours-requests/
```

### 2. Lấy yêu cầu chờ phê duyệt
```http
GET /api/working-hours-requests/pending/list
```

### 3. Phê duyệt yêu cầu
```http
PUT /api/working-hours-requests/{id}/approve
```

**Request Body:**
```json
{
  "approvalNote": "Phê duyệt do có việc khẩn cấp",
  "validHours": 24 // Thời gian hiệu lực (giờ), mặc định 24
}
```

### 4. Từ chối yêu cầu
```http
PUT /api/working-hours-requests/{id}/reject
```

**Request Body:**
```json
{
  "approvalNote": "Từ chối do không có lý do chính đáng"
}
```

### 5. Thống kê yêu cầu
```http
GET /api/working-hours-requests/stats/overview
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRequests": 150,
    "statusStats": [
      { "_id": "pending", "count": 20 },
      { "_id": "approved", "count": 80 },
      { "_id": "rejected", "count": 30 },
      { "_id": "used", "count": 15 },
      { "_id": "expired", "count": 5 }
    ],
    "typeStats": [
      { "_id": "entry", "count": 60 },
      { "_id": "exit", "count": 50 },
      { "_id": "both", "count": 40 }
    ],
    "dateRange": {
      "startDate": "2025-09-01",
      "endDate": "2025-09-30"
    }
  }
}
```

## Tích hợp với Access Logs

Khi có access log mới được tạo, hệ thống sẽ tự động:

1. Kiểm tra có yêu cầu đăng ký phù hợp không
2. Nếu có, đánh dấu yêu cầu là "used" và cập nhật access log
3. Khi phân tích vi phạm giờ hành chính, các access log có yêu cầu được phê duyệt sẽ không được tính là vi phạm

### Access Log với yêu cầu được phê duyệt:
```json
{
  "_id": "670123456789abcdef012347",
  "licensePlate": "29A12345",
  "action": "entry",
  "createdAt": "2025-09-28T07:30:00.000Z",
  "verificationStatus": "auto_approved",
  "verificationNote": "Auto-approved với confidence 0.95. Có yêu cầu đăng ký được phê duyệt: Có việc khẩn cấp...",
  "metadata": {
    "workingHoursRequest": {
      "requestId": "670123456789abcdef012345",
      "requestedBy": "670123456789abcdef012346",
      "reason": "Có việc khẩn cấp cần đến sớm để chuẩn bị họp với khách hàng",
      "approvedBy": "670123456789abcdef012348",
      "approvedAt": "2025-09-27T15:30:00.000Z"
    }
  }
}
```

## Quy trình sử dụng

1. **User tạo yêu cầu**: User tạo yêu cầu đăng ký khi biết trước sẽ cần ra/vào ngoài giờ quy định
2. **Admin phê duyệt**: Admin xem xét và phê duyệt/từ chối yêu cầu
3. **Tự động áp dụng**: Khi user thực sự ra/vào, hệ thống tự động kiểm tra và áp dụng yêu cầu đã được phê duyệt
4. **Báo cáo chính xác**: Các báo cáo vi phạm giờ hành chính sẽ không bao gồm các trường hợp có yêu cầu hợp lệ

## Validation Rules

- `plannedDateTime` phải lớn hơn thời gian hiện tại
- `plannedEndDateTime` (nếu có) phải lớn hơn `plannedDateTime`
- `licensePlate` phải thuộc về user tạo yêu cầu
- `reason` phải có ít nhất 10 ký tự
- Không được tạo yêu cầu trùng lặp trong khoảng thời gian ±2 giờ
- Chỉ có thể sửa yêu cầu khi đang ở trạng thái "pending"

## Status Flow

```
pending → approved → used (khi access log được tạo)
       ↘ rejected
       ↘ expired (tự động khi hết thời gian hiệu lực)
```
