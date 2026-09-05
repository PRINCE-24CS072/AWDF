# Practical 6: Full-Stack Task Desk

This monorepo connects a React frontend to the Practical 5 MongoDB task API.

## Structure

- `frontend/`: React + Vite application on `http://localhost:5173`
- `backend/`: Express + Mongoose API on `http://localhost:5000`

## Setup

### Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Update `backend/.env` with your MongoDB connection string, then run:

```powershell
npm start
```

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Features

- Loads tasks from MongoDB on page load
- Creates tasks through `POST /tasks`
- Updates tasks through `PUT /tasks/:id`
- Deletes tasks through `DELETE /tasks/:id` after confirmation
- Uses one shared `frontend/src/api.js` base URL
- Shows loading, error, and success/failure toast states for API operations
- Refreshes from persisted backend data using the refresh action or browser reload

## Evidence checklist

Capture screenshots of:

1. Backend terminal showing `MongoDB connected` and port `5000`.
2. Frontend terminal showing Vite running on port `5173`.
3. The task dashboard with at least two tasks.
4. A successful create toast.
5. Edit mode and the updated task.
6. Delete confirmation dialog and successful delete toast.
7. A refreshed browser page showing data still present.
8. MongoDB Atlas or Compass showing the `tasks` collection.
9. An invalid task request showing the validation error state.