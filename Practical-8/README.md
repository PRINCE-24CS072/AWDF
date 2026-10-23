# Practical 8 — React Route Lazy Loading

**Student:** Patel Prince · **ID:** 24CS072 · **Batch:** A2-Batch

This practical demonstrates route-based code splitting in the React frontend. The home page is loaded normally, while the Projects and Contact pages are downloaded only when their routes are visited.

## Implementation

- `React.lazy()` dynamically imports the Projects and Contact pages.
- `React.Suspense` displays a loading fallback while a page chunk is downloaded.
- Vite emits separate route chunks in the production build.
- The project also includes the task-management backend and frontend used by the following practicals.

## Run

```bash
cd Practical-8
npm install
cd frontend
npm install
npm run dev
```

The backend uses MongoDB. Configure `MONGO_URI` and `JWT_SECRET` from `.env.example`, then run `npm install` and `npm run dev` from the Practical-8 directory. The API runs on port 5000 by default.

## Verify code splitting

```bash
cd frontend
npm run build
```

Inspect the generated files under `frontend/dist/assets`; the route components are emitted as separate chunks.
