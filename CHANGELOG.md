# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-01-20

### Added
- 🏗️ **Initial project setup**
  - Express.js server with ES6 modules
  - MongoDB integration with Mongoose
  - JWT authentication system
  - Socket.IO for real-time communication

- 🔐 **Authentication & Authorization**
  - JWT token-based authentication
  - Refresh token mechanism
  - Role-based access control (Super Admin, Admin, User)
  - Password hashing with bcrypt
  - Rate limiting for security

- 👥 **User Management**
  - User CRUD operations
  - Profile management
  - Password change functionality
  - User activation/deactivation
  - Employee ID support

- 🚗 **Vehicle Management**
  - Vehicle registration with Vietnamese license plate validation
  - Vehicle CRUD operations
  - Insurance tracking
  - Maintenance history
  - Vehicle type classification
  - Owner management

- 📊 **Access Log System**
  - Real-time vehicle access logging
  - AI recognition data integration
  - Manual verification system
  - Confidence-based auto-approval
  - Entry/exit tracking with duration calculation
  - Gate management

- 🔌 **WebSocket Integration**
  - Real-time notifications
  - Python AI server connection
  - Client subscription system
  - Broadcast messaging

- 🛡️ **Security Features**
  - Helmet.js for HTTP security headers
  - CORS configuration
  - Input validation with Joi
  - SQL injection protection
  - XSS protection
  - Rate limiting

- 📝 **API Documentation**
  - Comprehensive API documentation
  - Postman collection
  - Example requests and responses
  - Error code documentation

- 🐳 **Development Tools**
  - Docker Compose for MongoDB
  - Development scripts
  - Environment configuration
  - Python client simulator
  - Database initialization scripts

### Technical Details
- **Backend**: Node.js 16+, Express.js 5.x
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.IO
- **Validation**: Joi schema validation
- **Security**: Helmet, bcrypt, rate limiting
- **Development**: Nodemon, Docker Compose

### File Structure
```
src/
├── config/          # Database configuration
├── controllers/     # Request handlers
├── middleware/      # Authentication, validation, logging
├── models/          # Mongoose schemas
├── routes/          # API routes
├── services/        # Business logic
├── socket/          # WebSocket handlers
└── utils/           # Helper functions
```

### Environment Variables
- `PORT`: Server port (default: 5000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: Refresh token secret
- `PYTHON_SERVER_URL`: WebSocket URL for AI server
- `SUPER_ADMIN_EMAIL`: Default super admin email
- `SUPER_ADMIN_PASSWORD`: Default super admin password

### License Plate Recognition
- Support for Vietnamese license plate formats
- Confidence-based validation
- Auto-approval for high-confidence results
- Manual verification system for edge cases
- Real-time processing integration
