const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Title is required"],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    completed: {
        type: Boolean,
        default: false,
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

taskSchema.pre("save", function trimTitle(next) {
    if (typeof this.title === "string") {
        this.title = this.title.trim();
    }
    next();
});

module.exports = mongoose.model("Task", taskSchema);