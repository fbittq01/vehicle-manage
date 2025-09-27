# Hướng dẫn Deploy lên Vercel

## 1. Chuẩn bị

### Cấu hình Environment Variables trên Vercel Dashboard:

```
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
BASE_URL=https://your-vercel-domain.vercel.app
ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
VERCEL=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
MAX_FILE_SIZE=5242880
```

## 2. Files được thêm/sửa đổi để tương thích với Vercel:

- `vercel.json`: Cấu hình routing và headers cho Vercel
- `api/index.js`: Entry point cho Vercel serverless functions
- `.vercelignore`: Loại trừ các files không cần thiết
- `package.json`: Thêm engines và scripts cho Vercel
- `src/server.js`: Cập nhật để tương thích với serverless environment
- `src/config/swagger.js`: Cấu hình server URL động

## 3. Các thay đổi chính:

### Content Security Policy (CSP)
- Cấu hình CSP cho phép Swagger UI hoạt động
- Cho phép unsafe-inline và unsafe-eval cho scripts
- Cho phép external CDN resources

### MIME Types
- Cấu hình đúng MIME types cho CSS và JS files
- Headers được set trong vercel.json và middleware

### Serverless Compatibility
- Tách biệt logic khởi tạo server cho local vs production
- Disable Socket.IO trên Vercel (serverless không hỗ trợ persistent connections)
- Export app object để Vercel có thể sử dụng

## 4. Deploy Command:

```bash
vercel --prod
```

## 5. Kiểm tra sau khi deploy:

- API endpoints: `https://your-domain.vercel.app/api/`
- Swagger UI: `https://your-domain.vercel.app/api-docs`
- Health check: `https://your-domain.vercel.app/`

## 6. Lưu ý:

- Socket.IO sẽ không hoạt động trên Vercel serverless functions
- File uploads có thể cần cấu hình thêm cho persistent storage
- Database connections được pool tự động bởi Vercel
