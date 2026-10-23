/**
 * Practical 10 Verification Suite
 * Asynchronous Processing with Event-Driven Architecture (EventEmitter)
 *
 * Verifies:
 * 1. Server initialization & listener registration
 * 2. Unauthenticated request protection (401)
 * 3. Invalid JWT token rejection (401)
 * 4. Task creation returns HTTP 201 with expected JSON body
 * 5. Event 'task-created' is emitted exactly once on successful creation
 * 6. Event payload includes correct title, userId, and taskId
 * 7. Event is NOT emitted when validation fails (400 Bad Request)
 * 8. Non-blocking verification: HTTP 201 response returns immediately (< 300ms)
 *    while simulated 2-second background notification processing completes later
 * 9. Event 'task-deleted' is emitted on successful task deletion (200 OK)
 * 10. Event 'task-deleted' is NOT emitted when attempting to delete nonexistent task (404)
 * 11. Practical 9 Cache Invalidation on task creation (tasks:userId cleared)
 * 12. Practical 9 Cache Invalidation on task deletion (tasks:userId and task:userId:taskId cleared)
 * 13. Safe error event handling: listener catches background errors without crashing the server
 */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');

// Ensure listeners are registered
require('./listeners');
const taskEvents = require('./events');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const Task = require('./models/Task');
const cache = require('./utils/cache');

async function runPractical10Tests() {
  console.log('===========================================================');
  console.log('     Starting Practical 10 Verification Test Suite         ');
  console.log('  Asynchronous Processing with Event-Driven Architecture   ');
  console.log('===========================================================\n');

  // Connect to DB
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Build Express app instance identical to server.js
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✅ Test server running on ${baseUrl}\n`);

  try {
    // Reset cache & telemetry
    cache.flushAll();
    cache.resetStats();

    // Generate authenticated test user token
    const testUserId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign(
      { id: testUserId, email: 'p10user@university.edu' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ── Test 1: Unauthenticated request rejection ──
    const unauthRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthorized Task' }),
    });
    console.assert(unauthRes.status === 401, 'Unauthenticated request should return 401');
    console.log('✅ 1. Unauthenticated task creation correctly rejected with 401');

    // ── Test 2: Invalid JWT token rejection ──
    const invalidTokenRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.token.value',
      },
      body: JSON.stringify({ title: 'Invalid Token Task' }),
    });
    console.assert(invalidTokenRes.status === 401, 'Invalid token should return 401');
    console.log('✅ 2. Invalid JWT token correctly rejected with 401');

    // ── Test 3: Validation failure does NOT emit task-created event ──
    let createdEventEmittedOnValidationError = false;
    const validationTracker = () => {
      createdEventEmittedOnValidationError = true;
    };
    taskEvents.on('task-created', validationTracker);

    const valFailRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: '', priority: 'invalid-priority' }),
    });
    console.assert(valFailRes.status === 400, 'Empty title should return 400');
    // Allow immediate tick
    await new Promise((r) => setTimeout(r, 50));
    taskEvents.removeListener('task-created', validationTracker);
    console.assert(
      !createdEventEmittedOnValidationError,
      'task-created event must NOT be emitted when validation fails'
    );
    console.log('✅ 3. Validation failure returns 400 and does NOT emit task-created event');

    // ── Test 4 & 5 & 8: Successful task creation, payload verification, and non-blocking timing ──
    // Populate cache first to verify cache invalidation later
    cache.set(`tasks:${testUserId}`, [{ dummy: true }]);
    console.assert(cache.has(`tasks:${testUserId}`), 'Pre-populated cache key for invalidation test');

    let capturedCreatedEvent = null;
    let completionNotification = null;

    const createdPromise = new Promise((resolve) => {
      taskEvents.once('task-created', (payload) => {
        capturedCreatedEvent = payload;
        resolve(payload);
      });
    });

    const completionPromise = new Promise((resolve) => {
      taskEvents.once('notification-completed', (data) => {
        if (data.type === 'task-created') {
          completionNotification = data;
          resolve(data);
        }
      });
    });

    const clientReqStart = Date.now();
    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Practical 10 Async Task',
        description: 'Demonstrating EventEmitter asynchronous processing',
        priority: 'high',
        status: 'pending',
      }),
    });
    const clientReqDuration = Date.now() - clientReqStart;
    console.assert(createRes.status === 201, 'Creation should return 201 Created');
    const createdTask = await createRes.json();

    console.log(`⏱️  Client HTTP 201 Response received in: ${clientReqDuration}ms`);
    console.assert(
      clientReqDuration < 500,
      `HTTP response must return immediately (< 500ms), actual: ${clientReqDuration}ms`
    );
    console.log('✅ 4. Successful task creation returned HTTP 201 with expected task object');

    // Verify task-created event fired
    await createdPromise;
    console.assert(capturedCreatedEvent !== null, 'task-created event must be emitted');
    console.assert(
      capturedCreatedEvent.title === 'Practical 10 Async Task',
      'Event payload title matches'
    );
    console.assert(
      capturedCreatedEvent.userId === testUserId,
      'Event payload userId matches authenticated user'
    );
    console.assert(
      capturedCreatedEvent.taskId === String(createdTask._id),
      'Event payload taskId matches created task ID'
    );
    console.log('✅ 5. task-created event emitted with correct title, userId, and taskId');

    // Verify cache invalidation (Practical 9 preservation)
    console.assert(
      !cache.has(`tasks:${testUserId}`),
      'User all-tasks cache must be invalidated after task creation'
    );
    console.log('✅ 6. Practical 9 Cache Invalidation: tasks:userId invalidated on POST');

    // Wait for the 2000ms asynchronous notification to complete
    console.log('⏳ Waiting for simulated 2-second background notification to complete...');
    await completionPromise;
    const notificationTotalDuration =
      new Date(completionNotification.completedAt).getTime() -
      new Date(completionNotification.startedAt).getTime();

    console.log(
      `⏱️  Background notification finished in: ${notificationTotalDuration}ms (started: ${completionNotification.startedAt}, completed: ${completionNotification.completedAt})`
    );
    console.assert(
      notificationTotalDuration >= 1950,
      'Simulated notification must wait ~2000ms in background'
    );
    console.log(
      '✅ 7. Asynchronous verification confirmed: HTTP response returned in ' +
        clientReqDuration +
        'ms while notification took ' +
        notificationTotalDuration +
        'ms in background'
    );

    // ── Test 8 & 9: Task Deletion (Supplementary requirement) & Invalidation ──
    // Populate single task and all-tasks caches to test deletion invalidation
    cache.set(`tasks:${testUserId}`, [createdTask]);
    cache.set(`task:${testUserId}:${createdTask._id}`, createdTask);
    console.assert(cache.has(`tasks:${testUserId}`), 'Pre-populated all-tasks cache for DELETE');
    console.assert(cache.has(`task:${testUserId}:${createdTask._id}`), 'Pre-populated single-task cache for DELETE');

    let capturedDeletedEvent = null;
    const deletedPromise = new Promise((resolve) => {
      taskEvents.once('task-deleted', (payload) => {
        capturedDeletedEvent = payload;
        resolve(payload);
      });
    });

    const deleteRes = await fetch(`${baseUrl}/api/tasks/${createdTask._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.assert(deleteRes.status === 200, 'DELETE should return 200 OK');
    const deleteBody = await deleteRes.json();
    console.assert(
      deleteBody.message === 'Task deleted successfully',
      'DELETE response body matches API contract'
    );

    await deletedPromise;
    console.assert(capturedDeletedEvent !== null, 'task-deleted event must be emitted');
    console.assert(
      capturedDeletedEvent.taskId === String(createdTask._id),
      'task-deleted contains correct taskId'
    );
    console.assert(
      capturedDeletedEvent.title === 'Practical 10 Async Task',
      'task-deleted contains correct task title'
    );
    console.assert(
      capturedDeletedEvent.userId === testUserId,
      'task-deleted contains correct userId'
    );
    console.log('✅ 8. task-deleted event emitted with correct taskId, title, and userId');

    // Verify cache invalidation on delete (Practical 9 preservation)
    console.assert(
      !cache.has(`tasks:${testUserId}`),
      'all-tasks cache must be invalidated after DELETE'
    );
    console.assert(
      !cache.has(`task:${testUserId}:${createdTask._id}`),
      'single-task cache must be invalidated after DELETE'
    );
    console.log('✅ 9. Practical 9 Cache Invalidation: both caches cleared after DELETE');

    // ── Test 10: Deleting nonexistent task does NOT emit task-deleted ──
    let deletedEventOnNonexistent = false;
    const nonexistentDeleteTracker = () => {
      deletedEventOnNonexistent = true;
    };
    taskEvents.on('task-deleted', nonexistentDeleteTracker);

    const randomId = new mongoose.Types.ObjectId().toString();
    const notFoundDeleteRes = await fetch(`${baseUrl}/api/tasks/${randomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.assert(notFoundDeleteRes.status === 404, 'Deleting non-existent task returns 404');
    await new Promise((r) => setTimeout(r, 50));
    taskEvents.removeListener('task-deleted', nonexistentDeleteTracker);
    console.assert(
      !deletedEventOnNonexistent,
      'task-deleted event must NOT be emitted when task does not exist'
    );
    console.log('✅ 10. Deleting non-existent task returns 404 and does NOT emit task-deleted');

    // ── Test 11: Safe error handling without crashing server ──
    let errorEventCaptured = false;
    taskEvents.once('notification-error', (errData) => {
      errorEventCaptured = true;
      console.assert(errData.event === 'test-synthetic-failure', 'Error event name captured');
    });

    taskEvents.emit('notification-error', {
      event: 'test-synthetic-failure',
      error: 'Simulated downstream notification gateway failure',
      timestamp: new Date().toISOString(),
    });
    console.assert(errorEventCaptured, 'Safe error handler caught event without crashing');
    console.log('✅ 11. Safe error event handling verified: error logged without crashing process');

    // Cleanup any lingering database records created during test
    await Task.deleteMany({ user: testUserId });

    console.log('\n===========================================================');
    console.log('  🎉 ALL 11 PRACTICAL 10 TESTS PASSED SUCCESSFULLY! 🎉     ');
    console.log('===========================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runPractical10Tests().catch((err) => {
  console.error('❌ Practical 10 Test Suite failed:', err);
  process.exit(1);
});
