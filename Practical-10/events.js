const EventEmitter = require('events');

/**
 * TaskEvents
 * Dedicated EventEmitter class for the Task Management application.
 * Manages domain events like 'task-created', 'task-deleted', and 'notification-error'.
 */
class TaskEvents extends EventEmitter {}

// Single shared instance exported throughout the application
const taskEvents = new TaskEvents();

module.exports = taskEvents;
