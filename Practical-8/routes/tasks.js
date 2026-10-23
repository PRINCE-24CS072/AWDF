const express = require('express');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const { validateTask } = require('../middleware/validate');

const router = express.Router();

// ── All task routes are protected by auth middleware ─────────────
router.use(auth);

/**
 * GET /api/tasks
 * List all tasks for the currently authenticated user.
 */
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/tasks/:id
 * Get a single task by ID (scoped to the authenticated user).
 */
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    console.error('Get task error:', err.message);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

/**
 * POST /api/tasks
 * Create a new task. Validation middleware checks title before this runs.
 */
router.post('/', validateTask, async (req, res) => {
  try {
    const { title, description, status, priority } = req.body;

    const task = await Task.create({
      title,
      description,
      status,
      priority,
      user: req.user.id,
    });

    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PUT /api/tasks/:id
 * Update a task. Validation middleware checks input first.
 */
router.put('/:id', validateTask, async (req, res) => {
  try {
    const { title, description, status, priority } = req.body;

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { title, description, status, priority },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (err) {
    console.error('Update task error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task (scoped to the authenticated user).
 */
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
