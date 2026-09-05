const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const taskRoutes = require("./routes/taskRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json());
app.use(logger);

app.get("/", (req, res) => {
    res.json({ message: "Practical 6 task API is running" });
});

app.use("/tasks", taskRoutes);

app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

async function startServer() {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not configured. Add it to backend/.env.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
        console.log(`Backend running at http://localhost:${PORT}`);
    });
}

startServer().catch((error) => {
    console.error("Unable to start backend:", error.message);
    process.exitCode = 1;
});

module.exports = app;