const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

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

// --- API Contract Placeholders ---

// Auth Routes
app.post('/api/auth/register', (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

app.post('/api/auth/login', (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

app.post('/api/auth/2fa/verify', (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

// Admin Routes
app.post('/api/admin/login', (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

app.get('/api/logs', (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

app.get('/api/admin/users', (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

app.patch('/api/admin/users/:id', (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

// Feed/Fetch Routes
app.post('/api/feed/fetch', (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

app.get('/api/feed/history', (req, res) => {
  res.status(501).json({ message: "Endpoint under construction (Phase 2)" });
});

app.listen(port, () => {
  console.log(`Backend API running on port ${port}`);
});
