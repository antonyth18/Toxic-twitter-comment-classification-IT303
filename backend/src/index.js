const express = require('express');
const cors = require('cors');
const prisma = require('./prisma');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const feedRoutes = require('./routes/feed');
const auditLogger = require('./middleware/audit');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Global Audit Logging Middleware (runs before response is sent)
app.use(auditLogger);

// Health Check Endpoint (checks database connection)
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      service: 'backend-api',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'backend-api',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Mount Routes
app.use('/api', authRoutes);
app.use('/api', adminRoutes);
app.use('/api', feedRoutes);

// Protected Admin Placeholders
app.get('/api/admin/users', authenticateToken, (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

app.patch('/api/admin/users/:id', authenticateToken, (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

// Only listen if executed directly (not when required by test runners)
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Backend API running on port ${port}`);
  });
}

module.exports = app;
