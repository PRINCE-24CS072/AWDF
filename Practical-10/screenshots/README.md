# Practical 10 — Screenshot & Evidence Capture Guide

This directory holds laboratory evidence and screenshots for **Practical 10: Asynchronous Processing with Event-Driven Architecture**.

---

## Required Lab Report Evidence Checklist

| Screenshot Filename | Description | How to Capture |
|---|---|---|
| `01_thunder_client_post_task_201.png` | Thunder Client showing `POST /api/tasks` returning `201 Created` immediately (~10ms) | In Thunder Client: Send `POST http://localhost:5000/api/tasks` with JSON body and `Authorization: Bearer <token>`. Capture the status code `201 Created`, response time, and JSON response. |
| `02_terminal_task_created_notification.png` | Backend terminal showing `[API] Sending 201 response` and `[Notification]` started | In VS Code terminal running `npm start`: Capture the log where `[API] Sending 201 response` is logged, followed by `[Notification] Task-created event received`, task title, user, and `Started At`. |
| `03_terminal_notification_completed_delay.png` | Backend terminal showing `[Notification] Completed At` exactly 2 seconds later | In the same terminal: Capture the `[Notification] Completed At` log entry showing the timestamp 2 seconds after `Started At`. |
| `04_thunder_client_delete_task_200.png` | Thunder Client showing `DELETE /api/tasks/:id` returning `200 OK` | In Thunder Client: Send `DELETE http://localhost:5000/api/tasks/<task_id>`. Capture the status `200 OK` and `{ "message": "Task deleted successfully" }`. |
| `05_terminal_task_deleted_notification.png` | Backend terminal showing `[Notification] Task-deleted event received` | In terminal: Capture the `[API] Sending 200 response for delete` and `[Notification] Task-deleted event received` log block. |
| `06_cache_invalidation_verification.png` | Verification that Practical 9 cache invalidation occurred after write operations | In Thunder Client: Request `GET /api/tasks/cache-stats` or send `GET /api/tasks` to verify `X-Cache: MISS` immediately following a POST or DELETE. |
| `07_automated_test_suite_passed.png` | Automated test suite execution showing all Practical 9 & 10 tests passing | In terminal: Run `npm test`. Capture the green passing output for all 13 Practical 9 tests and 11 Practical 10 tests. |

---

## Detailed Step-by-Step Reproduction Instructions

### Step 1: Start the Backend Server
```bash
npm start
```
Terminal will output:
```text
MongoDB connected successfully
Server running on http://localhost:5000
```

### Step 2: Authenticate in Thunder Client
1. Method: `POST`
2. URL: `http://localhost:5000/api/auth/login` (or `/api/auth/register` for a new account)
3. Headers: `Content-Type: application/json`
4. Body:
   ```json
   {
     "email": "student@university.edu",
     "password": "Password123!"
   }
   ```
5. Copy the `token` from the response.

### Step 3: Create Task & Observe Instant Response (`01` & `02` & `03`)
1. Method: `POST`
2. URL: `http://localhost:5000/api/tasks`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer <your_jwt_token>`
4. Body:
   ```json
   {
     "title": "Practical 10 Async Event Demo",
     "description": "Demonstrating non-blocking background notification",
     "priority": "high",
     "status": "pending"
   }
   ```
5. Click **Send**.
   - **Thunder Client**: Observe immediate `201 Created` response in ~5–15 ms (**Screenshot 01**).
   - **Terminal**: Look at console output (**Screenshot 02 & 03**):
     ```text
     [API] Sending 201 response at 2026-10-16T11:27:16.904Z
     [Notification] Task-created event received at 2026-10-16T11:27:16.905Z
     [Notification] Task: Practical 10 Async Event Demo
     [Notification] Assigned User: 6ad20a14d85b2a94c60dcabe
     [Notification] Started At: 2026-10-16T11:27:16.905Z
     [Notification] Simulated notification processing...
     [Notification] Completed At: 2026-10-16T11:27:18.914Z
     ```
   Notice that `Completed At` is logged 2000 ms later without blocking Thunder Client!

### Step 4: Delete Task & Observe Event (`04` & `05`)
1. Method: `DELETE`
2. URL: `http://localhost:5000/api/tasks/<task_id>`
3. Headers: `Authorization: Bearer <your_jwt_token>`
4. Click **Send** (**Screenshot 04**).
5. In terminal, observe (**Screenshot 05**):
   ```text
   [API] Sending 200 response for delete at 2026-10-16T11:27:19.430Z
   [Notification] Task-deleted event received at 2026-10-16T11:27:19.431Z
   [Notification] Task ID: <task_id>
   [Notification] Task: Practical 10 Async Event Demo
   [Notification] User: 6ad20a14d85b2a94c60dcabe
   [Notification] Timestamp: 2026-10-16T11:27:19.431Z
   ```

### Step 5: Run Automated Verification Suite (`07`)
```bash
npm test
```
All 24 automated unit and integration tests (13 for Practical 9 + 11 for Practical 10) will execute and print green checkmarks.
