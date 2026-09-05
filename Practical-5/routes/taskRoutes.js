const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");

const router = express.Router();

router.get("/", async (req, res, next) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const task = await findTaskById(req.params.id);

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json(task);
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const task = await Task.create(req.body);
        res.status(201).json({
            message: "Task created successfully",
            task,
        });
    } catch (error) {
        next(error);
    }
});

router.put("/:id", async (req, res, next) => {
    try {
        const task = await findTaskByIdAndUpdate(req.params.id, req.body);

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json({
            message: "Task updated successfully",
            task,
        });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const task = await findTaskByIdAndDelete(req.params.id);

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json({
            message: "Task deleted successfully",
        });
    } catch (error) {
        next(error);
    }
});

function findTaskById(id) {
    if (!mongoose.isValidObjectId(id)) {
        return null;
    }

    return Task.findById(id);
}

function findTaskByIdAndUpdate(id, updates) {
    if (!mongoose.isValidObjectId(id)) {
        return null;
    }

    return Task.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
    });
}

function findTaskByIdAndDelete(id) {
    if (!mongoose.isValidObjectId(id)) {
        return null;
    }

    return Task.findByIdAndDelete(id);
}

module.exports = router;