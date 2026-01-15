import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import routes from './routes/index.js';
import socketService from './socket/socketService.js';
import { initializeDatabase } from './services/initService.js';
import { setSocketService as setWorkingHoursSocketService } from './controllers/workingHoursRequestController.js';
import { setSocketService as setAccessLogSocketService } from './controllers/accessLogController.js';
import { setSocketService as setNotificationSocketService } from './controllers/notificationController.js';
import {
  devLogger,
  prodLogger,
  errorHandler,
  notFoundHandler
} from './middleware/logger.js';
import {
  generalLimiter
} from './middleware/rateLimiter.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration - Allow all origins
app.use(cors({
  origin: true, // Cho phép tất cả origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Serve static files từ uploads directory
app.use('/uploads', express.static('uploads'));

// Serve static files cho test client (chỉ trong development)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static('.'));
}

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  app.use(prodLogger);
} else {
  app.use(devLogger);
}

// Rate limiting
app.use('/api', generalLimiter);



// Routes
app.use('/api', routes);

// Health check cho root
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Hệ thống quản lý phương tiện API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    videoTestClient: '/video_test_client.html'
  });
});

// Serve video test client (chỉ trong development)
if (process.env.NODE_ENV !== 'production') {
  app.get('/test-client', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'video_test_client.html'));
  });
}

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection and server startup
const startServer = async () => {
  try {
    // Kết nối database
    await connectDB();
    
    // Initialize database (tạo super admin, etc.)
    await initializeDatabase();
    
    // Khởi tạo Socket.IO với HTTP server (async)
    const httpServer = await socketService.initialize(app);
    
    // Inject socketService vào các controllers
    setWorkingHoursSocketService(socketService);
    setAccessLogSocketService(socketService);
    setNotificationSocketService(socketService);
    
    console.log('✅ SocketService injected into controllers');
    
    // Thiết lập cleanup task cho notifications (chạy mỗi ngày lúc 2h sáng)
    const setupNotificationCleanup = () => {
      const now = new Date();
      const tomorrow2AM = new Date(now);
      tomorrow2AM.setDate(tomorrow2AM.getDate() + 1);
      tomorrow2AM.setHours(2, 0, 0, 0);
      
      const timeUntilCleanup = tomorrow2AM.getTime() - now.getTime();
      
      setTimeout(() => {
        // Chạy cleanup lần đầu
        socketService.cleanupExpiredNotifications();
        
        // Sau đó chạy mỗi 24 giờ
        setInterval(() => {
          socketService.cleanupExpiredNotifications();
        }, 24 * 60 * 60 * 1000); // 24 hours
        
      }, timeUntilCleanup);
      
      console.log('🧹 Notification cleanup scheduled for daily 2:00 AM');
    };
    
    setupNotificationCleanup();
    
    // Start server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📡 Socket.IO server is running`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      httpServer.close(() => {
        console.log('Server closed');
        socketService.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received. Shutting down gracefully...');
      httpServer.close(() => {
        console.log('Server closed');
        socketService.close();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start the server
startServer();
