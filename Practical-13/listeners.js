const taskEvents = require('./events');

/**
 * Register background event listeners for asynchronous event processing.
 * Keeps notification and background processing separate from Express route controllers.
 */
function initListeners() {
  // Clear any existing listeners to ensure single registration during startup or test runs
  taskEvents.removeAllListeners('task-created');
  taskEvents.removeAllListeners('task-deleted');
  taskEvents.removeAllListeners('notification-error');
  taskEvents.removeAllListeners('error');

  /**
   * Safe Error Handling:
   * Listen for notification errors and EventEmitter errors so unexpected
   * asynchronous failures never crash the Node.js server.
   */
  taskEvents.on('notification-error', ({ event, error, timestamp }) => {
    const errorTime = timestamp || new Date().toISOString();
    console.error(`[Notification Error] Event: ${event}`);
    console.error(`[Notification Error] Error: ${error}`);
    console.error(`[Notification Error] Timestamp: ${errorTime}`);
  });

  taskEvents.on('error', (err) => {
    console.error(`[Notification Error] Event: uncaught error`);
    console.error(`[Notification Error] Error: ${err && err.message ? err.message : err}`);
    console.error(`[Notification Error] Timestamp: ${new Date().toISOString()}`);
  });

  /**
   * Listener for 'task-created' event
   * Decoupled background processing: logs receipt, user, and title immediately,
   * then simulates an asynchronous notification delivery (e.g., email, push notification)
   * with a 2000ms delay using setTimeout without blocking the main event loop.
   */
  taskEvents.on('task-created', (taskData) => {
    try {
      const startedAt = new Date().toISOString();
      console.log(`[Notification] Task-created event received at ${startedAt}`);
      console.log(`[Notification] Task: ${taskData.title}`);
      console.log(`[Notification] Assigned User: ${taskData.userId}`);
      console.log(`[Notification] Started At: ${startedAt}`);
      console.log(`[Notification] Simulated notification processing...`);

      // Artificial non-blocking delay simulating third-party notification delivery
      setTimeout(() => {
        try {
          const completedAt = new Date().toISOString();
          console.log(`[Notification] Completed At: ${completedAt}`);

          // Telemetry event for test assertions and timing verification
          taskEvents.emit('notification-completed', {
            type: 'task-created',
            taskId: taskData.taskId,
            title: taskData.title,
            userId: taskData.userId,
            startedAt,
            completedAt,
          });
        } catch (asyncErr) {
          taskEvents.emit('notification-error', {
            event: 'task-created (async callback)',
            error: asyncErr.message,
            timestamp: new Date().toISOString(),
          });
        }
      }, 2000);
    } catch (err) {
      taskEvents.emit('notification-error', {
        event: 'task-created',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Listener for 'task-deleted' event (Supplementary Requirement)
   * Asynchronously logs notification of task deletion with ID, title, user, and timestamp.
   */
  taskEvents.on('task-deleted', (taskData) => {
    try {
      const timestamp = taskData.deletedAt || new Date().toISOString();
      console.log(`[Notification] Task-deleted event received at ${timestamp}`);
      console.log(`[Notification] Task ID: ${taskData.taskId}`);
      console.log(`[Notification] Task: ${taskData.title}`);
      console.log(`[Notification] User: ${taskData.userId}`);
      console.log(`[Notification] Timestamp: ${timestamp}`);

      taskEvents.emit('notification-completed', {
        type: 'task-deleted',
        taskId: taskData.taskId,
        title: taskData.title,
        userId: taskData.userId,
        timestamp,
      });
    } catch (err) {
      taskEvents.emit('notification-error', {
        event: 'task-deleted',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}

// Automatically register listeners on module startup
initListeners();

module.exports = {
  initListeners,
};
