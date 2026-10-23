# Practical 9 — In-Memory Caching and Query Optimization

**Student:** Patel Prince | **ID:** 24CS072 | **Batch:** A2-Batch

A full-stack Task Management application featuring JWT-based authentication, bcrypt password hashing, server-side in-memory caching with `node-cache`, MongoDB query optimization (compound indexing & `.lean()` queries), and cache telemetry monitoring.

---

## Tech Stack

- **Backend:** Node.js, Express.js, Mongoose, `node-cache`
- **Database:** MongoDB
- **Authentication & Security:** bcryptjs, jsonwebtoken
- **Validation:** express-validator
- **Frontend:** React, Vite / HTML, CSS, JavaScript

---

## Features

- **In-Memory Caching (`node-cache`)**:
  - Default 60-second TTL (`stdTTL: 60`) with automated eviction.
  - Multi-tenant user-scoped cache keys (`tasks:${userId}` and `task:${userId}:${taskId}`).
  - Cached responses return `X-Cache: HIT`; cache misses return `X-Cache: MISS`.
- **Cache Invalidation on Writes**:
  - Write operations (`POST`, `PUT`, `DELETE`) automatically invalidate affected cache keys only after successful database execution.
- **MongoDB Query Optimization**:
  - Single field index on `user` and compound index on `{ user: 1, createdAt: -1 }` to eliminate full collection scans (`COLLSCAN`) and memory sort stages.
  - `.lean()` execution to bypass Mongoose document hydration, significantly lowering memory footprint and execution latency.
- **Cache Telemetry & Debugging**:
  - Protected endpoint `GET /api/tasks/cache-stats` reporting hits, misses, sets, invalidations, and key counts without leaking sensitive data.
  - Reset endpoint `POST /api/tasks/cache-stats/reset` to reset counters for clean benchmarking.
- **Benchmarking & Cache Bypass**:
  - Support for `x-skip-cache: true` request header and `CACHE_ENABLED=false` environment toggle for baseline measurement.
- **Core App Features**:
  - User registration with bcrypt password hashing (salt rounds = 10).
  - JWT-based login with 1-hour token expiry.
  - Auth middleware protecting all task and cache routes.
  - Server-side input validation middleware.
  - Full CRUD for tasks (strictly scoped to the authenticated user).

---

## Setup & Installation

```bash
# 1. From the repository root, enter this practical
cd Practical-9

# 2. Install dependencies
npm install

# 3. Create .env configuration file
cp .env.example .env
# Configure MONGO_URI, JWT_SECRET, and PORT in .env

# 4. Run automated test suite
npm test

# 5. Start the backend development server
npm run dev

# 6. Access the application
# Frontend / API: http://localhost:5000
```

---

## Environment Variables (.env)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/taskmanager
JWT_SECRET=your_jwt_secret_key
# Optional: Set to false to disable in-memory caching during benchmarking
CACHE_ENABLED=true
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register a new user with hashed password | No |
| POST | `/api/auth/login` | Login and receive signed JWT token | No |
| GET | `/api/auth/me` | Fetch currently logged-in user profile | Bearer Token |

### Tasks & In-Memory Caching
| Method | Endpoint | Description | Cache Behavior | Auth Required |
|--------|----------|-------------|----------------|---------------|
| GET | `/api/tasks` | Get all tasks for logged-in user | Checks `tasks:${userId}` cache; returns `X-Cache: HIT` or `MISS` (60s TTL) | Bearer Token |
| GET | `/api/tasks/:id` | Get single task by ID | Checks `task:${userId}:${id}` cache; returns `X-Cache: HIT` or `MISS` (60s TTL) | Bearer Token |
| POST | `/api/tasks` | Create a new task | Invalidates `tasks:${userId}` cache | Bearer Token |
| PUT | `/api/tasks/:id` | Update an existing task | Invalidates `tasks:${userId}` and `task:${userId}:${id}` caches | Bearer Token |
| DELETE | `/api/tasks/:id` | Delete a task | Invalidates `tasks:${userId}` and `task:${userId}:${id}` caches | Bearer Token |

### Cache Telemetry & Debug
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/tasks/cache-stats` | Returns cache hit/miss counters and stats | Bearer Token |
| POST | `/api/tasks/cache-stats/reset` | Resets telemetry counters to zero | Bearer Token |

---

## In-Memory Caching Architecture

### 1. Shared Cache Module (`utils/cache.js`)
Configured using `node-cache`:
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
module.exports = cache;
```

### 2. Multi-Tenant Cache Keys
To maintain strict tenant isolation across multiple users:
- **All Tasks:** `tasks:${req.user.id}`
- **Single Task:** `task:${req.user.id}:${req.params.id}`

User A cannot retrieve or invalidate tasks belonging to User B.

### 3. Cache Invalidation Strategy
Invalidation triggers **only after** successful database operations:
- `POST /api/tasks` ➔ Clears `tasks:${userId}`.
- `PUT /api/tasks/:id` ➔ Clears both `tasks:${userId}` and `task:${userId}:${taskId}`.
- `DELETE /api/tasks/:id` ➔ Clears both `tasks:${userId}` and `task:${userId}:${taskId}`.

Validation errors (`400`) or not-found results (`404`) do not trigger invalidations.

---

## MongoDB Query Optimization

1. **Compound Index:**
   ```javascript
   taskSchema.index({ user: 1, createdAt: -1 });
   ```
   Directly accelerates `Task.find({ user: req.user.id }).sort({ createdAt: -1 })` using an index scan (`IXSCAN`), avoiding full collection scans (`COLLSCAN`) and memory sorting.

2. **Single-Field Index:**
   ```javascript
   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
   ```
   Speeds up single-task lookups by user.

3. **Mongoose `.lean()`:**
   Converts Mongoose Documents into lightweight Plain Old JavaScript Objects (POJOs), eliminating hydration overhead and decreasing response serialization time.

---

## Benchmarking Guide (Thunder Client)

### 1. Measure Uncached Baseline
1. Send `POST http://localhost:5000/api/auth/login` to obtain a JWT token.
2. In Thunder Client, configure a `GET http://localhost:5000/api/tasks` request with `Authorization: Bearer <token>`.
3. Add the header:
   ```http
   x-skip-cache: true
   ```
4. Send the request 3 times and record the response time in milliseconds displayed in Thunder Client (`X-Cache: MISS`).

### 2. Measure Cached Performance
1. Remove or disable the `x-skip-cache` header.
2. Send request 1: Cache miss (populates the cache with 60s TTL).
3. Send requests 2, 3, and 4: Cache hits (`X-Cache: HIT` served directly from memory).
4. Record response times to measure latency reduction.

---

## Verification & Automated Tests

Run the test suite:
```bash
npm test
```
The test suite validates:
- Unauthorized access rejection (`401`)
- Invalid token rejection (`401`)
- Malformed ID validation (`400`)
- Non-existent ID handling (`404`)
- All-tasks cache miss then hit (`X-Cache: MISS` ➔ `HIT`)
- User-level cache isolation across distinct accounts
- Write invalidation on `POST`, `PUT`, and `DELETE`
- Single task caching on `GET /api/tasks/:id`
- Telemetry reporting on `/api/tasks/cache-stats`
- Cache bypass via `x-skip-cache` header
