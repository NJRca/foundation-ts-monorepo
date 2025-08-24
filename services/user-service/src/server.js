const express = require('express');

// Simple configuration
const config = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Create Express application
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.nodeEnv
  });
});

// Basic user endpoints
app.get('/api/v1/users', (req, res) => {
  res.status(200).json({
    users: [
      {
        id: '1',
        name: 'Admin User',
        email: 'admin@foundation.local',
        roles: ['admin'],
        isActive: true
      }
    ],
    total: 1
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required'
    });
    return;
  }

  // Mock authentication
  if (email === 'admin@foundation.local' && password === 'admin123') {
    res.status(200).json({
      token: 'mock-jwt-token',
      refreshToken: 'mock-refresh-token',
      user: {
        id: '1',
        email: email,
        name: 'Admin User',
        roles: ['admin']
      }
    });
    return;
  }

  res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid credentials'
  });
});

// API info endpoint
app.get('/api/v1/info', (req, res) => {
  res.status(200).json({
    service: 'user-service',
    version: '1.0.0',
    description: 'Foundation TypeScript User Management Service',
    endpoints: [
      'GET /health',
      'GET /api/v1/users',
      'POST /api/v1/auth/login',
      'GET /api/v1/info'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
async function startServer() {
  try {
    console.log('Starting user service...');

    const server = app.listen(config.port, () => {
      console.log(`✅ User service started successfully on port ${config.port}`);
      console.log(`📋 Health check: http://localhost:${config.port}/health`);
      console.log(`📚 API info: http://localhost:${config.port}/api/v1/info`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown handlers
    const shutdown = () => {
      console.log('Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start user service:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  console.error('Startup error:', error);
  process.exit(1);
});

module.exports = app;
