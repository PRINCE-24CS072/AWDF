const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Register background event listeners for Practical 10
require('./listeners');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();

// ── Middleware Pipeline ──────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Request logging middleware (from Practical 4)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Serve static frontend files (prefers built React dist directory, falls back to public)
const fs = require('fs');
const distPath = path.join(__dirname, 'frontend', 'dist');
const publicPath = path.join(__dirname, 'public');
const staticPath = fs.existsSync(distPath) ? distPath : publicPath;

app.use(express.static(staticPath));

// ── Health Check Endpoint ───────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Catch-all: serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// ── Global Error Handler (from Practical 4) ─────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// ── Database Connection & Server Start ──────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/taskmanager';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT} (accessible at http://localhost:${PORT})`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
