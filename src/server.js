import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import routes from './routes/index.js';
import socketService from './socket/socketService.js';
import { initializeDatabase } from './services/initService.js';
import {
  devLogger,
  prodLogger,
  errorHandler,
  notFoundHandler
} from './middleware/logger.js';
import {
  generalLimiter
} from './middleware/rateLimiter.js';
import { specs, swaggerUi } from './config/swagger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'", 
        "https://unpkg.com",
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com",
        "https://unpkg.com"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files từ uploads directory với MIME types đúng
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  app.use(prodLogger);
} else {
  app.use(devLogger);
}

// Rate limiting
app.use('/api', generalLimiter);

// Swagger Documentation với cấu hình CSP cho Vercel
app.use('/api-docs', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://cdn.jsdelivr.net; " +
    "font-src 'self' https://fonts.gstatic.com https://unpkg.com; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self'; " +
    "worker-src 'self' blob:;"
  );
  next();
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .scheme-container { background: #fafafa; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
  `,
  customSiteTitle: 'Vehicle Management API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showRequestHeaders: true,
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch']
  }
}));

// Routes
app.use('/api', routes);

// Health check cho root
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Hệ thống quản lý phương tiện API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    documentation: '/api-docs'
  });
});

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
    
    // Chỉ khởi tạo Socket.IO và HTTP server khi không chạy trên Vercel
    if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
      // Khởi tạo Socket.IO với HTTP server
      const httpServer = socketService.initialize(app);
      
      // Start server
      httpServer.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
        console.log(`📡 Socket.IO server is running`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 API URL: http://localhost:${PORT}/api`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
        console.log(`📚 Documentation: http://localhost:${PORT}/api-docs`);
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
    } else {
      console.log('🚀 Vercel serverless function initialized');
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    }

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

// Export app for Vercel serverless functions
export default app;
