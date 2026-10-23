process.env.JWT_SECRET = process.env.JWT_SECRET || 'practical7_jwt_secret_key_2024';

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const cache = require('../utils/cache');

describe('Practical 12: CI/CD Pipeline Automated Test Suite', () => {
  let testUserId;
  let testToken;
  const JWT_SECRET = process.env.JWT_SECRET || 'practical7_jwt_secret_key_2024';

  beforeAll(async () => {
    // Generate valid test user ID and signed JWT token
    testUserId = new mongoose.Types.ObjectId().toString();
    testToken = jwt.sign(
      { id: testUserId, email: 'ci-runner@charusat.edu.in' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Attempt connection to test MongoDB instance if available
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/taskmanager';
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      }
    } catch (err) {
      // Safe isolated fallback if MongoDB service is not present
      console.warn('MongoDB service connection notice:', err.message);
    }
  });

  afterAll(async () => {
    try {
      // Disconnect mongoose if connected to allow clean Jest process exit
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    } catch (err) {
      console.warn('Teardown notice:', err.message);
    }
  });

  beforeEach(() => {
    // Clear cache entries between test cases
    cache.flushAll();
  });

  // ── Endpoint 1: Health Check (/api/health) ──────────────────────
  describe('GET /api/health (System Health Endpoint)', () => {
    it('should return HTTP 200 with healthy status and system metrics', async () => {
      const res = await request(app).get('/api/health');

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('uptime');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('database');
    });
  });

  // ── Endpoint 2: Tasks Authentication Security (/api/tasks & /tasks) ─
  describe('GET /api/tasks (Authentication Middleware Protection)', () => {
    it('should return HTTP 401 Unauthorized when no token is provided', async () => {
      const res = await request(app).get('/api/tasks');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/Access denied/i);
    });

    it('should return HTTP 401 Unauthorized when an invalid token is provided', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', 'Bearer invalid.bogus.jwt.token');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/Invalid token/i);
    });

    it('should return HTTP 200 and task list when authenticated with valid JWT', async () => {
      // Seed user cache to ensure deterministic, isolated execution in CI
      const sampleTasks = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          title: 'CI Automated Test Task',
          description: 'Testing task retrieval in GitHub Actions CI pipeline',
          status: 'pending',
          priority: 'high',
          user: testUserId,
          createdAt: new Date().toISOString(),
        },
      ];
      cache.set(`tasks:${testUserId}`, sampleTasks);

      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('CI Automated Test Task');
      expect(res.headers['x-cache']).toBe('HIT');
    });

    it('should also respond with HTTP 200 via /tasks alias route for lab manual compatibility', async () => {
      const sampleTasks = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          title: 'Lab Manual GET /tasks Route Test',
          status: 'completed',
          priority: 'medium',
          user: testUserId,
        },
      ];
      cache.set(`tasks:${testUserId}`, sampleTasks);

      const res = await request(app)
        .get('/tasks')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].title).toBe('Lab Manual GET /tasks Route Test');
    });
  });

  // ── Endpoint 3: Input Validation (/api/auth/register & /api/auth/login) ──
  describe('POST /api/auth/register (Request Validation Middleware)', () => {
    it('should return HTTP 400 Bad Request when required registration fields are invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: '123', // Less than 6 characters
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
      expect(res.body).toHaveProperty('details');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/auth/login (Login Request Validation)', () => {
    it('should return HTTP 400 Bad Request when email or password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
    });
  });
});
