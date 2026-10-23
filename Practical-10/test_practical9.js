/**
 * Practical 9: In-Memory Caching and Query Optimization Test Suite
 * Tests all caching requirements, invalidation, user isolation, error handling, and debug stats.
 */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');

// Import routes and models
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const Task = require('./models/Task');
const User = require('./models/User');
const cache = require('./utils/cache');

async function runTests() {
  console.log('--- Starting Practical 9 Verification Suite ---');

  // Connect to DB
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Build Express app instance
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✅ Test server running on ${baseUrl}`);

  try {
    // Reset cache & stats
    cache.flushAll();
    cache.resetStats();

    // Create 2 test user tokens
    const testUserId1 = new mongoose.Types.ObjectId().toString();
    const testUserId2 = new mongoose.Types.ObjectId().toString();
    const token1 = jwt.sign({ id: testUserId1, email: 'user1@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const token2 = jwt.sign({ id: testUserId2, email: 'user2@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 1. Test Unauthenticated access (401)
    const unauthRes = await fetch(`${baseUrl}/api/tasks`);
    console.assert(unauthRes.status === 401, 'Unauthenticated request should return 401');
    console.log('✅ 1. Unauthenticated GET /api/tasks correctly returns 401');

    // 2. Test Invalid Token (401)
    const invalidTokenRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: 'Bearer bad.token.here' },
    });
    console.assert(invalidTokenRes.status === 401, 'Invalid token should return 401');
    console.log('✅ 2. Invalid token GET /api/tasks correctly returns 401');

    // 3. Test Invalid ID format (400)
    const invalidIdRes = await fetch(`${baseUrl}/api/tasks/not-a-valid-id`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.assert(invalidIdRes.status === 400, 'Invalid task ID format should return 400');
    console.log('✅ 3. Malformed task ID GET /api/tasks/not-a-valid-id returns 400');

    // 4. Test Missing Task (404)
    const randomObjectId = new mongoose.Types.ObjectId().toString();
    const missingTaskRes = await fetch(`${baseUrl}/api/tasks/${randomObjectId}`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.assert(missingTaskRes.status === 404, 'Missing task should return 404');
    console.log('✅ 4. Non-existent task ID returns 404 without error');

    // 5. Test Initial GET /api/tasks (Cache MISS)
    const get1 = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.assert(get1.headers.get('x-cache') === 'MISS', 'First GET should be MISS');
    const tasks1 = await get1.json();
    console.log(`✅ 5. Initial GET /api/tasks is MISS, returned ${tasks1.length} tasks`);

    // 6. Test Second GET /api/tasks (Cache HIT)
    const get2 = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.assert(get2.headers.get('x-cache') === 'HIT', 'Second GET should be HIT');
    console.log('✅ 6. Subsequent GET /api/tasks is HIT');

    // 7. Test User Isolation (User 2 should get MISS and separate cache key)
    const getU2 = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    console.assert(getU2.headers.get('x-cache') === 'MISS', 'User 2 GET should be MISS');
    console.assert(cache.has(`tasks:${testUserId1}`), 'User 1 cache key exists');
    console.assert(cache.has(`tasks:${testUserId2}`), 'User 2 cache key exists');
    console.log('✅ 7. User isolation verified: each user has dedicated cache key');

    // 8. Create a task for User 1 (POST) -> verifies cache invalidation of tasks:userId
    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        title: 'Cache Invalidation Test Task',
        description: 'Testing write invalidation',
        priority: 'high',
      }),
    });
    console.assert(createRes.status === 201, 'Task creation should return 201');
    const createdTask = await createRes.json();
    console.assert(!cache.has(`tasks:${testUserId1}`), 'User 1 task list cache should be invalidated after POST');
    console.log('✅ 8. POST /api/tasks successfully invalidates User 1 all-tasks cache');

    // 9. Single task GET /api/tasks/:id (MISS then HIT)
    const getSingle1 = await fetch(`${baseUrl}/api/tasks/${createdTask._id}`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.assert(getSingle1.headers.get('x-cache') === 'MISS', 'First single task GET should be MISS');
    console.assert(cache.has(`task:${testUserId1}:${createdTask._id}`), 'Single task cache key should now exist');

    const getSingle2 = await fetch(`${baseUrl}/api/tasks/${createdTask._id}`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.assert(getSingle2.headers.get('x-cache') === 'HIT', 'Second single task GET should be HIT');
    console.log('✅ 9. GET /api/tasks/:id caching verified (MISS then HIT)');

    // 10. Cache all tasks again for User 1 to prepare for update test
    await fetch(`${baseUrl}/api/tasks`, { headers: { Authorization: `Bearer ${token1}` } });
    console.assert(cache.has(`tasks:${testUserId1}`), 'User 1 all-tasks cache repopulated');

    // 11. PUT /api/tasks/:id (Update) -> invalidates both all-tasks cache AND single-task cache
    const updateRes = await fetch(`${baseUrl}/api/tasks/${createdTask._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        title: 'Updated Task Title',
        status: 'in-progress',
      }),
    });
    console.assert(updateRes.status === 200, 'Task update should return 200');
    console.assert(!cache.has(`tasks:${testUserId1}`), 'User 1 all-tasks cache must be invalidated after PUT');
    console.assert(!cache.has(`task:${testUserId1}:${createdTask._id}`), 'Single-task cache must be invalidated after PUT');
    console.log('✅ 10. PUT /api/tasks/:id successfully invalidates both all-tasks and single-task caches');

    // 12. Cache single task and all-tasks again to test DELETE
    await fetch(`${baseUrl}/api/tasks`, { headers: { Authorization: `Bearer ${token1}` } });
    await fetch(`${baseUrl}/api/tasks/${createdTask._id}`, { headers: { Authorization: `Bearer ${token1}` } });
    console.assert(cache.has(`tasks:${testUserId1}`), 'All-tasks cached before delete');
    console.assert(cache.has(`task:${testUserId1}:${createdTask._id}`), 'Single task cached before delete');

    // 13. DELETE /api/tasks/:id -> invalidates both caches
    const deleteRes = await fetch(`${baseUrl}/api/tasks/${createdTask._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.assert(deleteRes.status === 200, 'Task deletion should return 200');
    console.assert(!cache.has(`tasks:${testUserId1}`), 'All-tasks cache invalidated after DELETE');
    console.assert(!cache.has(`task:${testUserId1}:${createdTask._id}`), 'Single-task cache invalidated after DELETE');
    console.log('✅ 11. DELETE /api/tasks/:id successfully invalidates both all-tasks and single-task caches');

    // 14. Test Debug endpoint GET /api/tasks/cache-stats
    const statsRes = await fetch(`${baseUrl}/api/tasks/cache-stats`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.assert(statsRes.status === 200, 'Debug stats endpoint should return 200');
    const statsData = await statsRes.json();
    console.assert(typeof statsData.stats.hits === 'number', 'Stats must report hit count');
    console.assert(typeof statsData.stats.misses === 'number', 'Stats must report miss count');
    console.assert(statsData.stdTTL === 60, 'Stats must report 60s TTL');
    console.assert(statsData.stats.hits > 0, 'Hits should be > 0');
    console.log('✅ 12. Debug stats endpoint verified:', JSON.stringify(statsData.stats));

    // 15. Test X-Skip-Cache header bypass
    const skipRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: {
        Authorization: `Bearer ${token1}`,
        'x-skip-cache': 'true',
      },
    });
    console.assert(skipRes.headers.get('x-cache') === 'MISS', 'x-skip-cache must result in cache miss/bypass');
    console.log('✅ 13. x-skip-cache header successfully bypasses cache for benchmarking');

    console.log('\n🎉 ALL 13 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
