process.env.JWT_SECRET = process.env.JWT_SECRET || 'practical7_jwt_secret_key_2024';

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Mock GoogleGenAI SDK to prevent any external paid calls or network reliance in CI
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
  };
});

const app = require('../server');
const aiRouter = require('../routes/ai');

describe('Practical 13: AI API Integration Test Suite', () => {
  let testUserId;
  let testToken;
  const JWT_SECRET = process.env.JWT_SECRET || 'practical7_jwt_secret_key_2024';
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;

  beforeAll(() => {
    testUserId = new mongoose.Types.ObjectId().toString();
    testToken = jwt.sign(
      { id: testUserId, email: 'ai-tester@charusat.edu.in' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    // Reset rate limits and mock invocations before each test
    if (aiRouter.resetRateLimits) {
      aiRouter.resetRateLimits();
    }
    mockGenerateContent.mockReset();
    // Default valid key for tests that simulate active provider
    process.env.GEMINI_API_KEY = 'test_mock_gemini_api_key_valid';
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  });

  // ── 1. Authentication Security ────────────────────────────────────
  describe('Authentication Security', () => {
    it('should return HTTP 401 when no Authorization token is provided', async () => {
      const res = await request(app)
        .post('/api/ai/generate-description')
        .send({ title: 'Plan database schema' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/Access denied/i);
    });

    it('should return HTTP 401 when an invalid token is provided', async () => {
      const res = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', 'Bearer invalid.fake.token')
        .send({ title: 'Plan database schema' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ── 2. Request Input Validation ───────────────────────────────────
  describe('Input Validation', () => {
    it('should return HTTP 400 when title is missing', async () => {
      const res = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/Task title is required/i);
    });

    it('should return HTTP 400 when title is an empty string or whitespace only', async () => {
      const res = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: '    ' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/Task title is required/i);
    });

    it('should return HTTP 400 when title exceeds 200 characters', async () => {
      const longTitle = 'A'.repeat(201);
      const res = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: longTitle });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/200 characters or fewer/i);
    });
  });

  // ── 3. Successful Generation ──────────────────────────────────────
  describe('AI Generation Success Path', () => {
    it('should return HTTP 200 with generated description and fallback=false', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'Review the official AWS certification guide and complete sample exam questions.',
      });

      const res = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Prepare for AWS AI Practitioner exam' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('description');
      expect(res.body.description).toBe(
        'Review the official AWS certification guide and complete sample exam questions.'
      );
      expect(res.body.fallback).toBe(false);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should also work seamlessly via the /ai/generate-description alias', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'Set up MongoDB indexes and run query execution benchmarks.',
      });

      const res = await request(app)
        .post('/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Optimize MongoDB indexes' });

      expect(res.statusCode).toBe(200);
      expect(res.body.fallback).toBe(false);
      expect(res.body.description).toBe(
        'Set up MongoDB indexes and run query execution benchmarks.'
      );
    });
  });

  // ── 4. Rate Limiting Enforcement ──────────────────────────────────
  describe('Rate Limiting (1 request per task/draft per 60s)', () => {
    it('should return HTTP 429 when requesting AI generation twice within 60s for the same draft', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'First generation succeeded.',
      });

      const draftPayload = {
        title: 'Draft task rate limit test',
        draftId: 'draft-uuid-12345',
      };

      // 1st request should succeed
      const firstRes = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send(draftPayload);

      expect(firstRes.statusCode).toBe(200);
      expect(firstRes.body.fallback).toBe(false);

      // 2nd immediate request for same draft should trigger HTTP 429 rate limit
      const secondRes = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send(draftPayload);

      expect(secondRes.statusCode).toBe(429);
      expect(secondRes.body).toHaveProperty('error');
      expect(secondRes.body.error).toMatch(/Rate limit exceeded/i);
      expect(secondRes.body).toHaveProperty('retryAfter');
    });

    it('should allow requests for different drafts or tasks without blocking', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({ text: 'Task A description' })
        .mockResolvedValueOnce({ text: 'Task B description' });

      const res1 = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Task A', draftId: 'draft-A' });

      const res2 = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Task B', draftId: 'draft-B' });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
    });
  });

  // ── 5. Graceful Degradation & Provider Failures ───────────────────
  describe('Graceful Degradation Handling', () => {
    it('should return a fallback response when GEMINI_API_KEY is missing or placeholder', async () => {
      process.env.GEMINI_API_KEY = 'your_gemini_api_key_here';

      const res = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Test without configured API key' });

      expect(res.statusCode).toBe(200);
      expect(res.body.fallback).toBe(true);
      expect(res.body.description).toBe('');
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/temporarily unavailable/i);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should catch third-party provider API errors (quota/auth) without crashing server', async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new Error('Google Generative AI Error: 429 Resource has been exhausted (quota exceeded)')
      );

      const res = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Quota exhaustion test task' });

      expect(res.statusCode).toBe(200);
      expect(res.body.fallback).toBe(true);
      expect(res.body.description).toBe('');
      expect(res.body.message).toMatch(/temporarily unavailable/i);
    });

    it('should return fallback if AI response text is empty', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: '' });

      const res = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Empty output test' });

      expect(res.statusCode).toBe(200);
      expect(res.body.fallback).toBe(true);
      expect(res.body.description).toBe('');
    });

    it('should catch request timeout and return graceful fallback response deterministically', async () => {
      // Set short 50ms timeout window for fast, isolated test execution
      process.env.AI_TIMEOUT_MS = '50';
      // Mock generation delay exceeding 50ms
      mockGenerateContent.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      );

      const res = await request(app)
        .post('/api/ai/generate-description')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Simulated timeout task' });

      expect(res.statusCode).toBe(200);
      expect(res.body.fallback).toBe(true);
      expect(res.body.description).toBe('');
      expect(res.body.message).toMatch(/temporarily unavailable/i);

      delete process.env.AI_TIMEOUT_MS;
    });
  });
});
