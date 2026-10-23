const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const auth = require('../middleware/auth');

const router = express.Router();

// ── Rate Limiter Store ─────────────────────────────────────────────
// Map of rateLimitKey -> timestamp of last request (in ms)
// Target behavior: 1 AI generation request per task/draft per 60 seconds.
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds

/**
 * Periodically purge stale entries from memory every 5 minutes
 */
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Reset rate limit entries (used in automated tests to ensure test isolation)
 */
const resetRateLimits = () => {
  rateLimitMap.clear();
};

/**
 * Server-Side Rate Limiting Middleware
 * Scopes rate-limits strictly to req.user.id (server-verified JWT) and either:
 * - taskId (for existing saved tasks)
 * - draftId (client-generated UUID for new unsaved tasks)
 * - normalized task title snippet (fallback if no identifier supplied)
 */
const aiRateLimiter = (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { taskId, draftId, title } = req.body;
  const resourceKey = taskId
    ? `task:${taskId}`
    : draftId
    ? `draft:${draftId}`
    : `draft_title:${(title || '').trim().toLowerCase().slice(0, 50)}`;

  const limitKey = `ai_rate:${userId}:${resourceKey}`;
  const now = Date.now();
  const lastRequestTime = rateLimitMap.get(limitKey);

  if (lastRequestTime && now - lastRequestTime < RATE_LIMIT_WINDOW_MS) {
    const remainingSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastRequestTime)) / 1000);
    return res.status(429).json({
      error: 'Rate limit exceeded. You can only generate one AI description per task every 60 seconds.',
      retryAfter: remainingSeconds,
    });
  }

  // Record this request
  rateLimitMap.set(limitKey, now);
  next();
};

/**
 * POST /api/ai/generate-description
 * Protected by JWT authentication middleware.
 * Accepts: { title: string, taskId?: string, draftId?: string }
 *
 * Success (HTTP 200):
 *   { description: string, fallback: false }
 *
 * Graceful Fallback (HTTP 200):
 *   { description: '', fallback: true, message: string }
 *
 * Validation Failure (HTTP 400):
 *   { error: string }
 *
 * Rate Limit Exceeded (HTTP 429):
 *   { error: string, retryAfter: number }
 */
router.post(
  '/generate-description',
  auth,
  (req, res, next) => {
    // ── Server-side Input Validation ─────────────────────────────
    const { title } = req.body;

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        error: 'Task title is required and cannot be empty.',
      });
    }

    const trimmedTitle = title.trim();

    if (trimmedTitle.length > 200) {
      return res.status(400).json({
        error: 'Task title must be 200 characters or fewer.',
      });
    }

    req.cleanTitle = trimmedTitle;
    next();
  },
  aiRateLimiter,
  async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;

    // Graceful fallback if API key is missing or default placeholder
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
      console.warn('[AI Service] GEMINI_API_KEY is not configured. Serving graceful fallback response.');
      return res.status(200).json({
        description: '',
        fallback: true,
        message: 'AI description generation is temporarily unavailable. You can write the description manually.',
      });
    }

    let timerId;
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

      // Enforce 8-second timeout on third-party AI call (configurable for deterministic testing)
      const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 8000;
      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => {
          const timeoutErr = new Error(`AI service request timed out after ${TIMEOUT_MS / 1000} seconds`);
          timeoutErr.name = 'TimeoutError';
          reject(timeoutErr);
        }, TIMEOUT_MS);
        if (timerId.unref) timerId.unref();
      });

      const generationPromise = ai.models.generateContent({
        model,
        contents: `Task title: "${req.cleanTitle}"`,
        config: {
          systemInstruction:
            'You are a task management assistant. Generate a concise, actionable, 1-2 sentence task description (under 200 characters) explaining what needs to be done. Do not include markdown, quotes, bullet points, introductory phrases, or conversational filler. Return only the description text.',
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      });

      const response = await Promise.race([generationPromise, timeoutPromise]);

      // Parse generated description across SDK response formats
      let descriptionText = '';
      if (response && typeof response.text === 'function') {
        descriptionText = response.text();
      } else if (response && typeof response.text === 'string') {
        descriptionText = response.text;
      } else if (
        response &&
        response.candidates &&
        response.candidates[0]?.content?.parts?.[0]?.text
      ) {
        descriptionText = response.candidates[0].content.parts[0].text;
      }

      descriptionText = descriptionText.trim().replace(/^["']|["']$/g, '');

      if (!descriptionText) {
        return res.status(200).json({
          description: '',
          fallback: true,
          message: 'AI returned an empty description. You can write the description manually.',
        });
      }

      return res.status(200).json({
        description: descriptionText,
        fallback: false,
      });
    } catch (err) {
      // Safe diagnostic logging: Do NOT log secrets, full prompts, or authorization headers
      console.warn(`[AI Service Fallback Triggered] Error: ${err.message}`);

      return res.status(200).json({
        description: '',
        fallback: true,
        message: 'AI description generation is temporarily unavailable. You can write the description manually.',
      });
    } finally {
      // Ensure timeout timer is cleared on both success and error paths
      if (timerId) {
        clearTimeout(timerId);
      }
    }
  }
);

router.resetRateLimits = resetRateLimits;
module.exports = router;
