# Practical 5: MongoDB Integration

This practical replaces Practical 4's in-memory task array with MongoDB and Mongoose.

## Setup

1. Install MongoDB locally or create a MongoDB Atlas cluster.
2. From this folder, run `npm install`.
3. Copy `.env.example` to `.env` and set `MONGO_URI`.
4. Start the API with `npm start`.

The server runs at `http://localhost:3000` by default.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/tasks` | List all tasks |
| GET | `/tasks/:id` | Get one task, or return 404 |
| POST | `/tasks` | Create a task |
| PUT | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |

Example POST body:

```json
{
  "title": "  Learn Mongoose  ",
  "description": "Practice schema validation",
  "completed": false,
  "priority": "high"
}
```

`title` is required. `completed` defaults to `false`, `priority` defaults to `medium`, and `createdAt` defaults to the current date. Priority accepts only `low`, `medium`, or `high`.