# 🔧 Troubleshooting Guide

## ❌ Lỗi có thể xảy ra sau khi loại bỏ Docker

### 1. **MongoDB Connection Error**
```
MongoServerError: connect ECONNREFUSED 127.0.0.1:27017
```

**Nguyên nhân**: MongoDB chưa được cài đặt hoặc chưa khởi động

**Giải pháp**:
```bash
# macOS - Cài đặt MongoDB
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Linux - Cài đặt MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Windows - Download và cài từ website
# https://www.mongodb.com/try/download/community
```

### 2. **Database Not Found Error**
```
MongoServerError: Database 'quan_ly_phuong_tien' not found
```

**Nguyên nhân**: Database chưa được tạo

**Giải pháp**:
```bash
# Chạy script setup database
npm run setup:db

# Hoặc thủ công
mongosh
use quan_ly_phuong_tien
```

### 3. **Missing Indexes Error**
```
Performance warning: No index found for query
```

**Nguyên nhân**: Indexes chưa được tạo

**Giải pháp**:
```bash
# Chạy setup database để tạo indexes
npm run setup:db
```

### 4. **Permission Denied Error (Linux/macOS)**
```
Error: EACCES: permission denied, mkdir '/data/db'
```

**Nguyên nhân**: MongoDB cần quyền tạo data directory

**Giải pháp**:
```bash
# Tạo data directory với quyền phù hợp
sudo mkdir -p /data/db
sudo chown $(whoami) /data/db

# Hoặc dùng custom data path
mongod --dbpath ~/mongodb-data
```

### 5. **Port Already in Use**
```
Error: listen EADDRINUSE: address already in use :::27017
```

**Nguyên nhân**: Có process khác đang dùng port 27017

**Giải pháp**:
```bash
# Kiểm tra process nào đang dùng port
sudo lsof -iTCP:27017 -sTCP:LISTEN

# Kill process cũ
sudo kill -9 <PID>

# Hoặc restart MongoDB service
brew services restart mongodb-community  # macOS
sudo systemctl restart mongod           # Linux
```

### 6. **Environment Variables Not Found**
```
Error: JWT_SECRET is not defined
```

**Nguyên nhân**: File .env chưa được tạo hoặc thiếu variables

**Giải pháp**:
```bash
# Copy từ example file
cp .env.example .env

# Kiểm tra file .env có đủ variables
cat .env
```

### 7. **Module Not Found Error**
```
Error: Cannot find module 'mongodb'
```

**Nguyên nhân**: Thiếu dependencies

**Giải pháp**:
```bash
# Cài đặt lại dependencies
npm install

# Hoặc cài specific package
npm install mongodb
```

### 8. **Super Admin Not Created**
```
Error: No super admin found in system
```

**Nguyên nhân**: Script init không chạy thành công

**Giải pháp**:
```bash
# Restart server để chạy lại init script
npm run dev

# Hoặc thủ công tạo super admin trong MongoDB
mongosh quan_ly_phuong_tien
db.users.insertOne({
  email: "superadmin@system.com",
  password: "$2a$12$...", // hash của SuperAdmin123!
  name: "Super Administrator",
  role: "super_admin",
  isActive: true
})
```

### 9. **WebSocket Connection Failed**
```
Error: WebSocket connection failed to ws://localhost:8888
```

**Nguyên nhân**: Python AI server chưa chạy

**Giải pháp**:
```bash
# Bỏ qua lỗi này nếu chưa có Python server
# Hoặc update PYTHON_SERVER_URL trong .env
PYTHON_SERVER_URL=ws://your-python-server:port
```

### 10. **Testing với Python Client Lỗi**
```
requests.exceptions.ConnectionError
```

**Nguyên nhân**: Node.js server chưa chạy

**Giải pháp**:
```bash
# Đảm bảo server đang chạy
npm run dev

# Test API endpoint
curl http://localhost:5000/api/health
```

## ✅ Verification Steps

### 1. Kiểm tra MongoDB
```bash
# Test connection
mongosh --eval "db.adminCommand('ismaster')"

# Kiểm tra database
mongosh quan_ly_phuong_tien --eval "show collections"
```

### 2. Kiểm tra Node.js Server
```bash
# Test basic setup
npm run test:basic

# Test API health
curl http://localhost:5000/api/health
```

### 3. Kiểm tra Database Setup
```bash
# Run database setup
npm run setup:db

# Verify indexes
mongosh quan_ly_phuong_tien --eval "db.users.getIndexes()"
```

### 4. Full System Test
```bash
# 1. Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod           # Linux

# 2. Setup database
npm run setup:db

# 3. Start server
npm run dev

# 4. Test API in another terminal
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@system.com","password":"SuperAdmin123!"}'
```

## 📞 Support

Nếu gặp lỗi khác, vui lòng:
1. Kiểm tra logs chi tiết
2. Đảm bảo đã follow đúng setup steps
3. Kiểm tra system requirements
4. Tạo issue với error logs đầy đủ
