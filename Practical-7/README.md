# Practical 7 — Task Management with JWT Authentication

A full-stack Task Management application with JWT-based authentication, bcrypt password hashing, and Express middleware pipeline.

**Student Details:**
- **Name:** Patel Prince
- **Roll No / ID:** 24CS072
- **Batch:** A2-Batch

---

## Tech Stack

- **Backend:** Node.js, Express.js, Mongoose
- **Database:** MongoDB (Local or Atlas)
- **Auth:** bcryptjs, jsonwebtoken
- **Validation:** express-validator
- **Frontend:** Vanilla HTML5, Modern CSS (Glassmorphism + Responsive Design), Vanilla JavaScript (ES6+)

---

## Features

- **User Registration:** Secure password hashing using `bcryptjs` with salt rounds = 10.
- **JWT-Based Login:** Issue tokens with 1-hour expiry, stored securely in client localStorage.
- **Protected `/api/auth/me` Endpoint:** Verifies token and returns authenticated user profile.
- **JWT Auth Middleware:** Protects all task endpoints, extracting and verifying `Bearer <token>` in the Authorization header.
- **Server-Side Input Validation:** Uses `express-validator` to validate and sanitize registration, login, and task payloads before hitting controllers.
- **Full Scoped CRUD:** Every task is scoped to `req.user.id`, ensuring complete multi-tenant data privacy.
- **Fast Status Toggling:** `PATCH /api/tasks/:id/toggle` enables 1-click status switching directly from task cards.
- **Real-Time Client Updates:** Automatic task counts, filter tabs (All, Pending, In Progress, Completed), and modal editors.
- **401 Unauthorized Handling:** Frontend automatically redirects to login screen when token expires or becomes invalid.
- **Logout:** Client-side token and session cleanup.

---

## Setup & Running

### 1. Install Dependencies

```powershell
cd Practical-7
npm install
```

### 2. Environment Variables

Create a `.env` file (or copy from `.env.example`):

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/awdf_practical7
JWT_SECRET=awdf_practical_7_super_secret_jwt_key_24cs072
```

> **Note:** If using MongoDB Atlas, replace `MONGO_URI` with your connection string.

### 3. Start the Server

```powershell
# Development mode with auto-reload:
npm run dev

# Or standard production mode:
npm start
```

### 4. Open Application

Visit: `http://localhost:5000`

---

## API Endpoints

### Auth Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Register a new user account | No |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | No |
| `GET` | `/api/auth/me` | Fetch currently logged-in user profile | Yes (Bearer) |

### Task Endpoints (All require `Authorization: Bearer <token>`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | Retrieve all tasks belonging to authenticated user |
| `GET` | `/api/tasks/:id` | Retrieve single task by ID |
| `POST` | `/api/tasks` | Create a new task (validates title, priority, status) |
| `PUT` | `/api/tasks/:id` | Update an existing task |
| `PATCH` | `/api/tasks/:id/toggle` | Quick-toggle task between completed and pending |
| `DELETE` | `/api/tasks/:id` | Delete task by ID |

---

## Architecture & Middleware Flow

```
Request (e.g. POST /api/tasks)
  │
  ├──► express.json() & cors()
  │
  ├──► Logging Middleware (method, URL, timestamp)
  │
  ├──► Auth Middleware (verify Bearer JWT -> set req.user)
  │
  ├──► Validation Middleware (express-validator -> 400 on error)
  │
  ├──► Controller / Route Handler (scoped to req.user.id)
  │
  └──► MongoDB (via Mongoose)
```
