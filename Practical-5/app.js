const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const taskRoutes = require("./routes/taskRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(logger);
app.use("/tasks", taskRoutes);

app.use((req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

app.use(errorHandler);

async function startServer() {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not configured. Add it to Practical-5/.env.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

startServer().catch((error) => {
    console.error("Unable to start server:", error.message);
    process.exitCode = 1;
});

module.exports = app;