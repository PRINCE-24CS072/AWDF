# Practical 10 — Asynchronous Processing with Event-Driven Architecture

**Student:** Patel Prince | **ID:** 24CS072 | **Batch:** A2-Batch

A full-stack Task Management application implementing **Practical 10: Asynchronous Background Processing with Node.js Event-Driven Architecture (`EventEmitter`)**, built upon Practical 7 (JWT Authentication & Middleware Pipeline), Practical 8 (React Lazy Loading & Code Splitting), and Practical 9 (In-Memory Caching & Query Optimization).

---

## Tech Stack

- **Backend:** Node.js, Express.js (v4.21), Mongoose (v8.6)
- **Event Architecture:** Native Node.js `events` module (`EventEmitter`)
- **Database:** MongoDB with Mongoose compound indexing & `.lean()` query optimizations
- **Caching:** `node-cache` (60s TTL, user-scoped keys, automatic invalidation on writes)
- **Authentication & Security:** JWT (`jsonwebtoken`), bcrypt password hashing (`bcryptjs`)
- **Validation:** Server-side request validation (`express-validator`)
- **Frontend:** React with Vite, `React.lazy()` route-based code splitting, and `Suspense`

---

## Features

- **Asynchronous Background Processing (Practical 10):**
  - Native `EventEmitter` architecture via decoupled [events.js](./events.js) and [listeners.js](./listeners.js).
  - Immediate HTTP `201 Created` API response (typically **7–15 ms**), completely decoupled from downstream tasks.
  - Custom `task-created` event emitted via `setImmediate()` with payload: `taskId`, `title`, `userId`, `createdAt`.
  - Non-blocking notification handler with simulated 2000 ms delivery delay via `setTimeout()`.
  - Supplementary `task-deleted` event emitted on successful document deletion.
  - Safe error event listener (`notification-error` and `error`) preventing server crashes from background exceptions.
- **In-Memory Caching & Optimization (Practical 9):**
  - In-memory caching for `GET /api/tasks` and `GET /api/tasks/:id` with 60-second TTL.
  - Multi-tenant user isolation via user-scoped cache keys (`tasks:${userId}`, `task:${userId}:${taskId}`).
  - Cache invalidation on `POST`, `PUT`, and `DELETE`.
  - Response headers (`X-Cache: HIT` / `X-Cache: MISS`) and benchmarking bypass (`x-skip-cache: true`).
  - Cache telemetry endpoints (`GET /api/tasks/cache-stats`, `POST /api/tasks/cache-stats/reset`).
  - Compound MongoDB index `{ user: 1, createdAt: -1 }` and `.lean()` document hydration bypass.
- **React Performance Optimization (Practical 8):**
  - Route-based code splitting using `React.lazy()` and `React.Suspense` for `/projects` and `/contact`.
- **Authentication & CRUD (Practical 7):**
  - User registration with bcrypt hashing (salt rounds = 10).
  - JWT login with 1-hour expiry and token verification middleware.
  - Full task CRUD scoped strictly to the authenticated user.

---

## Setup & Running

```bash
# 1. Clone the repository
cd Practical-10

# 2. Install backend dependencies
npm install

# 3. Configure environment variables (copy from .env.example)
cp .env.example .env
# Ensure MONGO_URI and JWT_SECRET are configured

# 4. Run automated test suites (Practical 9 & Practical 10)
npm test

# 5. Start the backend server
npm start
# Server runs at http://localhost:5000

# 6. (Optional) Run React frontend
cd frontend
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user with hashed password | No |
| `POST` | `/api/auth/login` | Login and obtain JWT Bearer token | No |
| `GET` | `/api/auth/me` | Get profile of authenticated user | Yes (`Bearer <token>`) |

### Tasks (Protected — require `Authorization: Bearer <token>`)
| Method | Endpoint | Description | Cache Behavior | Event Emitted |
|---|---|---|---|---|
| `GET` | `/api/tasks` | Get all tasks for user | Checks cache; sets 60s TTL | None |
| `GET` | `/api/tasks/:id` | Get single task by ID | Checks cache; sets 60s TTL | None |
| `POST` | `/api/tasks` | Create task, responds HTTP 201 | Invalidates `tasks:${userId}` | `task-created` |
| `PUT` | `/api/tasks/:id` | Update task by ID | Invalidates list & item cache | None |
| `DELETE` | `/api/tasks/:id` | Delete task by ID | Invalidates list & item cache | `task-deleted` |

### Cache Telemetry & Benchmarking
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/tasks/cache-stats` | Get hit/miss/invalidation counts & memory stats | Yes |
| `POST` | `/api/tasks/cache-stats/reset` | Reset cache counters before benchmark runs | Yes |

---

## Practical 10 — Architecture & Design

```
HTTP Client (Thunder Client / React)
        │
        ▼ POST /api/tasks
┌────────────────────────────────────────────────────────┐
│ Express Router (`routes/tasks.js`)                     │
│ 1. Validate request payload (`validateTask`)           │
│ 2. Save Task to MongoDB (`Task.create`)                │
│ 3. Invalidate User Cache (`cache.invalidateUserTasks`) │
│ 4. Send HTTP 201 Created Response ─────────────────────┼──► Client receives HTTP 201 (~10ms)
│ 5. Schedule event emission via `setImmediate()`        │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼ emit('task-created', taskData)
┌────────────────────────────────────────────────────────┐
│ Shared EventEmitter (`events.js`)                      │
│ Class `TaskEvents extends EventEmitter`                │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼ .on('task-created') listener
┌────────────────────────────────────────────────────────┐
│ Listener Module (`listeners.js`)                       │
│ 1. Log event receipt immediately (Task, User, Time)    │
│ 2. Schedule slow notification via `setTimeout()`       │
│ 3. Asynchronously completes after 2000ms delay         │
│ 4. Log completion timestamp                            │
└────────────────────────────────────────────────────────┘
```

### Components Implemented

1. **Dedicated Event Module ([events.js](./events.js))**:
   - Implements `class TaskEvents extends EventEmitter {}`.
   - Exports a single shared instance throughout the application so all routes and listeners communicate via the same event bus.

2. **Dedicated Listener Module ([listeners.js](./listeners.js))**:
   - Registered once during application startup in [server.js](./server.js#L8).
   - Listens for `task-created`, logs task title, assigned user ID, and start timestamp, then triggers a simulated 2000 ms notification dispatch using `setTimeout()`.
   - Listens for `task-deleted` (supplementary requirement), logging the deleted task ID, title, user, and deletion timestamp.
   - Registers error listeners (`notification-error` and `error`) to catch asynchronous listener errors and log structured telemetry without crashing the Node.js server process.

3. **Decoupled Task Creation ([routes/tasks.js](./routes/tasks.js))**:
   - Preserves all authentication (`auth.js`), validation (`validateTask`), MongoDB operations (`Task.create`), and Practical 9 cache invalidations (`cache.invalidateUserTasks`).
   - Dispatches the HTTP 201 response immediately before executing background notification work using `setImmediate()`.
   - Real timestamps verify that the HTTP response is sent before the notification handler finishes.

4. **Task Deletion Event Integration ([routes/tasks.js](./routes/tasks.js))**:
   - Preserves ownership checks, database deletion (`Task.findOneAndDelete`), and dual cache invalidation (`tasks:${userId}` and `task:${userId}:${taskId}`).
   - Emits `task-deleted` only upon successful document deletion.
   - Does NOT emit events if the task does not exist (404) or if deletion fails.

### Synchronous vs Asynchronous Handling in Node.js

- **Synchronous Event Listener Invocation**: In Node.js, `EventEmitter.emit()` executes registered event listener functions synchronously in the order they were registered. If a listener executes a synchronous blocking loop (e.g. `while (Date.now() - start < 2000)`), the main thread and HTTP response would freeze.
- **Asynchronous Work Scheduling**: To prevent blocking, our listener receives the event and promptly schedules the heavy notification task onto the Node.js libuv timer phase using `setTimeout(..., 2000)`.
- **Deferred Emission via `setImmediate()`**: In `routes/tasks.js`, `taskEvents.emit()` is wrapped in `setImmediate()`, ensuring the HTTP response is flushed and dispatched to the client before the event handler starts execution.

### In-Process EventEmitter vs Distributed Message Queues

| Feature | Node.js native `EventEmitter` | Distributed Queue (RabbitMQ / BullMQ / Kafka) |
|---|---|---|
| **Infrastructure** | Zero dependencies, built into Node.js runtime | Requires external broker (Redis, RabbitMQ, Kafka cluster) |
| **Durability** | In-memory only; events lost if process restarts | Durable; messages persisted to disk/WAL |
| **Horizontal Scaling** | Isolated to single Node.js process; cannot cross cluster workers | Shared across all worker nodes, clusters, and microservices |
| **Retries & Dead Letter** | Must be coded manually; crashes if unhandled | Built-in ACK/NACK, exponential backoff, and DLQ |
| **Best Used For** | In-process decoupling, local telemetry, small-scale web apps | High-throughput, distributed systems, mission-critical jobs |

---

## Automated Verification Suite

The repository includes complete test suites for both Practical 9 and Practical 10:

```bash
# Run both test suites
npm test

# Run individual suites
npm run test:p9
npm run test:p10
```

### Test Results (24 / 24 Tests Passed):
- **Practical 9 Verification Suite (13 / 13 passed)**:
  - Cache hits, misses, TTL, user isolation, cache invalidation on POST, PUT, DELETE, and cache bypass header (`x-skip-cache`).
- **Practical 10 Verification Suite (11 / 11 passed)**:
  - Unauthenticated requests rejected (401).
  - Invalid JWT tokens rejected (401).
  - Validation failure returns 400 and suppresses event emission.
  - HTTP 201 returns immediately (~10 ms) while notification completes after 2000 ms.
  - `task-created` payload verified (title, userId, taskId).
  - Practical 9 cache invalidation confirmed on POST (`tasks:${userId}` invalidated).
  - `task-deleted` event emitted on successful deletion.
  - Cache invalidation confirmed on DELETE (both list and single task caches invalidated).
  - Deletion of nonexistent task returns 404 and suppresses event emission.
  - Safe error event handling verified without server crashes.

### Step-by-Step Thunder Client Testing & Screenshots
Refer to [`screenshots/README.md`](./screenshots/README.md) for the complete screenshot capture checklist, sample requests, and evidence guidelines.

---

## Foundational Practicals (Preserved Architecture)

<details>
<summary><strong>Practical 9 — In-Memory Caching and Query Optimization</strong></summary>

### Overview
Practical 9 implements server-side in-memory caching using `node-cache` and database query optimization in MongoDB/Mongoose to reduce response latency and database read load for task retrieval.

### Concepts & Implementation Details
- **In-Memory Caching (`node-cache`)**:
  - Implemented shared cache module in `utils/cache.js` with standard TTL of 60 seconds (`stdTTL: 60`).
  - Read endpoints check memory first before querying MongoDB.
  - Returns `X-Cache: HIT` or `X-Cache: MISS` response headers.
- **Cache Keys & Multi-Tenant Data Isolation**:
  - All tasks list: `tasks:${userId}`
  - Single task item: `task:${userId}:${taskId}`
  - Including the authenticated `userId` guarantees complete user data isolation.
- **Cache Invalidation on Writes**:
  - `POST /api/tasks`: Invalidates `tasks:${userId}` upon successful creation.
  - `PUT /api/tasks/:id`: Invalidates both `tasks:${userId}` and `task:${userId}:${taskId}` upon successful update.
  - `DELETE /api/tasks/:id`: Invalidates both `tasks:${userId}` and `task:${userId}:${taskId}` upon successful deletion.
  - Invalidation only triggers on successful operations (never on validation failure or 404).
- **Query Optimizations**:
  - **Mongoose Compound Index**: `taskSchema.index({ user: 1, createdAt: -1 })` avoids full collection scans (`COLLSCAN`) and memory sort overhead during task list queries.
  - **Single Field Index**: `user: { index: true }` accelerates single-item lookups.
  - **`.lean()` Execution**: Bypasses Mongoose document hydration to return plain JavaScript objects, reducing CPU and RAM overhead.
- **Cache Monitoring & Telemetry**:
  - Protected endpoint `GET /api/tasks/cache-stats` reports hit/miss/invalidation counters without exposing secrets or task data.
  - Protected endpoint `POST /api/tasks/cache-stats/reset` resets telemetry counters for clean benchmarking.
- **Cache Bypass for Benchmarking**:
  - Set `CACHE_ENABLED=false` in `.env`, or send request header `x-skip-cache: true` in Thunder Client.
</details>

<details>
<summary><strong>Practical 8 — Performance Optimization & Lazy Loading in React</strong></summary>

### Overview
Practical 8 introduces route-based code splitting and lazy loading to optimize initial application load time and minimize the initial JavaScript payload size delivered to the user.

### Concepts & Concepts Implemented
- **Lazy Loading**: A performance optimization strategy where resources/components are fetched on-demand when required, rather than downloading the entire application payload upfront.
- **`React.lazy()`**: React standard utility that dynamically imports a component using ECMAScript dynamic `import()`, enabling automated code-splitting by bundlers like Vite.
- **`React.Suspense`**: A React component boundary wrapper that displays fallback UI (`<LoadingPage />`) while pending dynamically-imported route chunks are being fetched across the network.
- **Route-Based Code Splitting**:
  - `Home` (`/`) route remains a static import loaded during initial render.
  - `Projects` (`/projects`) route is lazy-loaded into a separate bundle chunk (`Projects-*.js`).
  - `Contact` (`/contact`) route is lazy-loaded into a separate bundle chunk (`Contact-*.js`).
</details>

<details>
<summary><strong>Practical 7 — Task Management with JWT Authentication</strong></summary>

### Overview
Full-stack Task Management application with JWT-based authentication, bcrypt password hashing, and Express middleware pipeline.

### Features
- User registration with bcrypt password hashing
- JWT-based login with 1-hour token expiry
- Auth middleware protecting all task routes
- Server-side input validation middleware
- Full CRUD for tasks (scoped to authenticated user)
- `/me` endpoint for current user details
- 401 handling — frontend redirects to login on expired token
- Logout clears token from client
</details>
