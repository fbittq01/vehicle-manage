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
import { specs, swaggerUi, swaggerSetup, swaggerUIOptions } from './config/swagger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Disable default CSP để sử dụng custom CSP cho Swagger
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://vehicles-manager-fe-79nq.vercel.app/'],
  credentials: true
}));
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files từ uploads directory
app.use('/uploads', express.static('uploads'));

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  app.use(prodLogger);
} else {
  app.use(devLogger);
}

// Rate limiting
app.use('/api', generalLimiter);

// Swagger Documentation với CSP middleware
app.use('/api-docs', swaggerSetup);
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(specs, swaggerUIOptions));

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
    
    // Khởi tạo Socket.IO với HTTP server
    const httpServer = socketService.initialize(app);
    
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
