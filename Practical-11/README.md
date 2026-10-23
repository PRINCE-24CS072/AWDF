# Practical 11 — Containerization with Docker and Docker Compose

**Student:** Patel Prince | **ID:** 24CS072 | **Batch:** A2-Batch

A full-stack Task Management application containerized with Docker and orchestrated using Docker Compose, integrating a React (Vite) frontend, Node.js/Express backend API, and MongoDB database with persistent volumes and health checks (building upon Practicals 1–10).

## Tech Stack

- **Frontend:** React 18, React Router 6, Vite 5
- **Backend:** Node.js, Express.js, Mongoose
- **Database:** MongoDB (Official Docker image)
- **Containerization & Orchestration:** Docker, Docker Compose
- **Auth & Security:** bcryptjs, jsonwebtoken (JWT)
- **Validation:** express-validator
- **Optimization & Events:** node-cache (P9), EventEmitter async notifications (P10)

## Features

- Multi-container architecture orchestrated via Docker Compose (`docker compose up --build`)
- React Vite frontend served via multi-stage Docker build on port `5173`
- Node.js Express backend API running on port `5000` with `/api/health` monitoring
- MongoDB service on port `27017` with Docker named volume (`mongodb_data`) data persistence
- User registration with bcrypt password hashing
- JWT-based login with 1-hour token expiry
- Auth middleware protecting all task routes
- Server-side input validation middleware
- Full CRUD for tasks (scoped to authenticated user)
- `/me` endpoint for current user details
- 401 handling — frontend redirects to login on expired token
- In-memory caching with multi-tenant isolation and write invalidation (Practical 9)
- Non-blocking asynchronous background notification dispatch via EventEmitter (Practical 10)

## Quick Start (Docker Compose)

The entire full-stack application boots with a single command:

```bash
# 1. Clone the repo
cd Practical-11

# 2. Start all services (frontend, backend, mongodb)
docker compose up --build

# 3. Access the application:
# Frontend UI: http://localhost:5173
# Backend API: http://localhost:5000
# Health Check: http://localhost:5000/api/health
```

### Standalone Local Development (Without Docker)

```bash
# 1. Install dependencies
npm install
cd frontend && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Ensure MongoDB is running locally on port 27017

# 3. Start backend & frontend
npm run dev
# In a second terminal:
cd frontend && npm run dev
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user (protected) |

### Tasks (All protected — require Bearer token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all tasks for logged-in user |
| POST | `/api/tasks` | Create a new task |
| PUT | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

## Architecture

```text
Browser ──► Frontend (React / Vite, port 5173)
                 │
                 ▼ (REST API / JSON)
            Backend (Node / Express, port 5000)
                 │
                 ▼ (Mongoose / TCP)
            MongoDB (Database, port 27017)
```

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

### Bundle Structure & Loading Mechanics
Route-specific JavaScript is now decoupled from the main bundle and fetched only when navigating to `/projects` or `/contact`. 

Note: Network performance metrics (initial bundle size, load time, JS requests, chunk transfer sizes) are recorded manually via Chrome DevTools under Slow 3G throttling.

## Practical 9 — In-Memory Caching and Query Optimization

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
  - Protected endpoint `GET /api/tasks/cache-stats` (alias `GET /api/tasks/cache/debug`) reports hit/miss/invalidation counters without exposing secrets or task data.
  - Protected endpoint `POST /api/tasks/cache-stats/reset` resets telemetry counters for clean benchmarking.
- **Cache Bypass for Benchmarking**:
  - Set `CACHE_ENABLED=false` in `.env`, or send request header `x-skip-cache: true` in Thunder Client.

## Practical 10 — Asynchronous Processing with Event-Driven Architecture

### Overview
Practical 10 implements asynchronous background processing within the Task Management application using Node.js's native `EventEmitter` from the built-in `events` module. Decoupling notification side effects from the core HTTP request-response cycle ensures that client write requests return immediately (typically in 5–15 ms) without being blocked by slow downstream tasks such as email delivery, push notifications, or third-party webhooks.

### Architecture & Design
```
Client (Thunder Client / React)
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

1. **Dedicated Event Module (`events.js`)**:
   - Implements `class TaskEvents extends EventEmitter {}`.
   - Exports a single shared instance throughout the application so all routes and listeners communicate via the same event bus.

2. **Dedicated Listener Module (`listeners.js`)**:
   - Registered once during application startup in `server.js`.
   - Listens for `task-created`, logs task title, assigned user ID, and start timestamp, then triggers a simulated 2000 ms notification dispatch using `setTimeout()`.
   - Listens for `task-deleted` (supplementary requirement), logging the deleted task ID, title, user, and deletion timestamp.
   - Registers error listeners (`notification-error` and `error`) to catch asynchronous listener errors and log structured telemetry without crashing the Node.js server process.

3. **Decoupled Task Creation (`routes/tasks.js`)**:
   - Preserves all authentication (`auth.js`), validation (`validateTask`), MongoDB operations (`Task.create`), and Practical 9 cache invalidations (`cache.invalidateUserTasks`).
   - Dispatches the HTTP 201 response immediately before executing background notification work using `setImmediate()`.
   - Real timestamps verify that the HTTP response is sent before the notification handler finishes.

4. **Task Deletion Event Integration (`routes/tasks.js`)**:
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

### Verification and Test Suite Results

The project includes automated verification test suites for both Practical 9 and Practical 10:

```bash
# Run both verification suites
npm test

# Run individual suites
npm run test:p9
npm run test:p10
```

#### Verification Suite Output:
- **Practical 9 Verification Suite (13 / 13 tests passed)**:
  - Cache hits, misses, TTL, user isolation, cache invalidation on POST, PUT, DELETE, and cache bypass header (`x-skip-cache`).
- **Practical 10 Verification Suite (11 / 11 tests passed)**:
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

## Practical 11 — Containerization with Docker and Docker Compose

### Overview
Practical 11 containerizes the complete full-stack Task Management application using Docker and orchestrates the multi-container architecture using Docker Compose. The entire system—React frontend, Node.js/Express backend API, and MongoDB database—boots with a single command (`docker compose up --build`), communicating securely over an isolated internal bridge network with data persistence and container health checks.

### Prerequisites
- **Docker Desktop** (or Docker Engine on Linux) installed and running.
- **Docker Compose** (bundled with Docker Desktop as `docker compose`).
- Verified via:
  ```bash
  docker --version
  docker compose version
  ```

---

### Three-Service Architecture

```
                                  HOST MACHINE
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Web Browser (Host) ────────► http://localhost:5173 (Frontend UI)          │
│   Thunder Client / API ──────► http://localhost:5000 (Backend API)          │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ Docker Network: `app-network` (bridge)                                │ │
│   │                                                                       │ │
│   │   ┌───────────────────────┐           ┌───────────────────────┐       │ │
│   │   │  taskmanager-frontend │           │  taskmanager-backend  │       │ │
│   │   │  (React / Vite Build) │──────────►│  (Node.js / Express)  │       │ │
│   │   │  Internal port: 5173  │  /api/*   │  Internal port: 5000  │       │ │
│   │   └───────────────────────┘           └───────────┬───────────┘       │ │
│   │                                                   │                   │ │
│   │                                                   │ MONGO_URI         │ │
│   │                                                   ▼ mongodb:27017     │ │
│   │                                       ┌───────────────────────┐       │ │
│   │                                       │  taskmanager-mongodb  │       │ │
│   │                                       │  (Official mongo)     │       │ │
│   │                                       │  Internal port: 27017 │       │ │
│   │                                       └───────────┬───────────┘       │ │
│   │                                                   │                   │ │
│   └───────────────────────────────────────────────────┼───────────────────┘ │
│                                                       │                     │
│                                                       ▼                     │
│                                           Named Docker Volume               │
│                                           `taskmanager_mongodb_data`        │
│                                           (/data/db on host disk)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Communication Flow
1. **User / Browser → Frontend (`http://localhost:5173`)**: The host browser accesses the React single-page application served by the frontend container.
2. **Frontend → Backend (`http://backend:5000` / `/api`)**: Browser requests to `/api` are proxied by the frontend container to `http://backend:5000` via Docker's internal DNS resolution on `app-network`. Alternatively, browser clients can communicate directly with `http://localhost:5000`.
3. **Backend → MongoDB (`mongodb://mongodb:27017/taskmanager`)**: The backend container resolves the hostname `mongodb` to the MongoDB container's internal IP address.
4. **Data Persistence**: MongoDB stores all BSON collections in `/data/db`, mounted to the Docker named volume `mongodb_data`.

---

### Dockerfiles & Image Design

#### 1. Backend Dockerfile (`./Dockerfile`)
- **Base Image:** `node:18`
- **Working Directory:** `/app`
- **Layer Caching:** Copies `package*.json` manifests before source files so that dependency layers are cached unless `package.json` changes.
- **Clean Dependency Install:** Executes `npm ci` inside the Linux container, building native dependencies specifically for the container environment.
- **Port:** Declares `EXPOSE 5000`.
- **Network Interface:** Backend server explicitly binds to `0.0.0.0:5000` ensuring incoming traffic forwarded from host port 5000 is accepted.
- **Entry Point:** `CMD ["node", "server.js"]`

#### 2. Frontend Multi-Stage Dockerfile (`./frontend/Dockerfile`)
Uses a **multi-stage build** to optimize build speed and keep the production runtime image small and clean:
- **Stage 1 (Build Stage - `node:18 AS build`):**
  - Installs all dependencies (including devDependencies like Vite and React plugins).
  - Executes `npm run build` to compile the JSX into optimized, minified bundles in `/app/dist`.
- **Stage 2 (Runtime Stage - `node:18-slim AS runner`):**
  - Uses a lightweight Debian-based `node:18-slim` image.
  - Copies only the production artifacts (`dist/`), `vite.config.js`, and runtime dependencies from the build stage.
  - Raw source code (`src/`), build tools, git history, and unneeded assets are discarded.
  - Exposes port `5173` and starts the Vite preview server bound to `0.0.0.0:5173`:
    ```dockerfile
    CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
    ```

---

### Role of `.dockerignore` Files

Both the backend (`./.dockerignore`) and frontend (`./frontend/.dockerignore`) define strict exclusions:
- **`node_modules`:** Prevents copying the host's existing `node_modules` directory into the Docker image build context.
- **`.env` and secrets:** Prevents accidental leakage of local passwords, JWT secrets, or connection strings into publicly distributable container images.
- **`.git` & `.github`:** Omits repository history and metadata, reducing image layer sizes.
- **Build artifacts (`dist/`, `coverage/`, `screenshots/`):** Avoids copying stale local build outputs into the container.

---

### Core Questions & Analysis

#### Q1: Why does the backend container need to reference the MongoDB container by its service name (`mongodb`) rather than `localhost`?
In Docker networking:
- Every container runs inside its own isolated **network namespace** with its own loopback interface (`127.0.0.1` / `localhost`).
- Inside the `backend` container, `localhost` points only to the backend container itself—not to the host machine and not to MongoDB.
- Under Docker Compose, all services attached to a user-defined bridge network (`app-network`) share Docker's **embedded DNS server** (at `127.0.0.11`).
- The embedded DNS server automatically maps the Compose service name `mongodb` to the internal dynamic IP assigned to the MongoDB container.
- Therefore, the backend must connect using `mongodb://mongodb:27017/taskmanager`.

#### Q2: What is the difference between `EXPOSE` in a Dockerfile and `ports` in `docker-compose.yml`?
- **`EXPOSE` (Dockerfile):**
  - Acts as internal container metadata and documentation.
  - Signals to developers and the Docker engine which ports the containerized process intends to listen on.
  - Does **not** publish or bind the port to the host machine's network interfaces. Other containers on the same network can access it, but the host machine's browser cannot.
- **`ports` (docker-compose.yml):**
  - Actually **publishes** and maps container ports to host network interfaces (`HOST:CONTAINER`).
  - Example: `"5173:5173"` instructs Docker to open port 5173 on the host and forward all incoming host TCP traffic directly to port 5173 of the container.

#### Q3: Why is it bad practice to copy `node_modules` into a Docker image instead of running `npm install` / `npm ci` inside the container?
1. **Architecture & OS Incompatibility:** Host machines frequently run Windows or macOS (Darwin) on x86_64 or ARM64. Packages containing native C/C++ compiled binaries (such as `bcryptjs` / native crypto, `esbuild`, or `rollup`) compiled on the host will fail to execute inside a Linux container.
2. **Build Context Bloat:** `node_modules` contains thousands of files and hundreds of megabytes. Copying it forces Docker to send a massive context payload across the Docker daemon socket, severely slowing build times.
3. **Determinism:** Running `npm ci` inside the container guarantees a clean, reproducible installation matching `package-lock.json` compiled natively for the container's Linux target architecture.

#### Q4: How does the MongoDB named volume preserve data across container restarts?
- Containers have ephemeral writable layers. When a container is removed (`docker rm` or `docker compose down`), its writable layer is destroyed.
- A **named volume** (`mongodb_data:/data/db`) is a dedicated directory managed by Docker on the host storage disk outside of the container's lifecycle.
- When `docker compose down` runs, containers and networks are stopped and removed, but the named volume remains intact on disk.
- When `docker compose up` is run again, the volume is remounted to `/data/db`, restoring all existing tasks, users, and collections without any data loss.
- **Note:** Never run `docker compose down -v` unless you intentionally want to delete all persistent database records.

---

### Docker Compose Operational Commands

| Action | Command | Purpose |
|---|---|---|
| **Build & Start Stack** | `docker compose up --build` | Builds images, creates network/volume, and starts all 3 services with foreground logging |
| **Start in Background** | `docker compose up --build -d` | Starts containers in detached (daemon) mode, returning control to terminal |
| **List Running Containers** | `docker ps` | Verifies container status, ports, and health status |
| **Inspect Compose Services** | `docker compose ps` | Displays service status, exit codes, and exposed ports |
| **View Live Logs** | `docker compose logs -f` | Streams consolidated logs from frontend, backend, and mongodb |
| **View Backend Logs Only** | `docker compose logs -f backend` | Filters logs specifically for the backend service |
| **Validate Compose Syntax** | `docker compose config` | Parses and validates `docker-compose.yml` against the Compose specification |
| **Stop Stack (Preserve Data)** | `docker compose down` | Gracefully stops containers and network; **preserves** MongoDB volume data |
| **Restart Single Service** | `docker compose restart backend` | Restarts the backend service without tearing down MongoDB or frontend |

---

### Step-by-Step Verification & Lab Evidence

```bash
# 1. Run the local automated verification suite
npm test

# Or run the Practical 11 containerization verification specifically:
npm run test:p11
```

#### End-to-End Verification Checklist:
1. **Frontend UI:** Open `http://localhost:5173` in your browser. Verify the Task Management application renders cleanly.
2. **Backend Health Check:** Visit `http://localhost:5000/api/health`. Expected output:
   ```json
   {
     "status": "healthy",
     "timestamp": "2026-10-16T18:50:00.000Z",
     "uptime": 45.2,
     "database": "connected"
   }
   ```
3. **Database CRUD Operations:**
   - Register a new user in the frontend or via Thunder Client (`POST /api/auth/register`).
   - Create a task (`POST /api/tasks`).
   - Stop the stack with `docker compose down`.
   - Restart the stack with `docker compose up -d`.
   - Verify that your created tasks and users are still present (verifying named volume persistence).
4. **Cache & Event Verification:**
   - Practical 9 cache response header `X-Cache: HIT` / `X-Cache: MISS` functions as expected.
   - Practical 10 background notification logs continue to appear in backend logs (`docker compose logs -f backend`).

---

### Troubleshooting Guide

| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| **Backend cannot connect to MongoDB** (`ECONNREFUSED mongodb:27017`) | `MONGO_URI` still points to `localhost:27017` inside the container | Ensure `docker-compose.yml` sets `MONGO_URI=mongodb://mongodb:27017/taskmanager`. Check that backend `depends_on` includes `mongodb` with `condition: service_healthy`. |
| **Port already in use** (`Bind for 0.0.0.0:5000 failed`) | A local Node process or another container is bound to port 5000, 5173, or 27017 | Run `netstat -ano \| findstr :5000` or `docker ps` to identify conflicting processes. Stop local Node or conflicting containers. |
| **Docker build is extremely slow** | `node_modules` is being copied into the Docker build context | Verify `.dockerignore` exists in root and contains `node_modules` and `frontend`. |
| **Frontend changes not reflecting** | Old cached image layers are being reused | Run `docker compose up --build` to force a rebuild of the frontend image. |
| **Database is wiped after stop** | User executed `docker compose down -v` | Use `docker compose down` (without `-v`) to preserve the `mongodb_data` named volume. |

