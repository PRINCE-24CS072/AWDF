import { useEffect, useState } from "react";
import { createTask, deleteTask, getTasks, updateTask } from "./api";
import "./App.css";

const emptyForm = { title: "", description: "", priority: "medium" };

function App() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      setTasks(await getTasks());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function updateForm(event, setter) {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setOperation("create");
    setError("");
    try {
      const response = await createTask({ ...form, completed: false });
      setTasks((current) => [response.task, ...current]);
      setForm(emptyForm);
      showToast("Task created successfully", "success");
    } catch (requestError) {
      setError(requestError.message);
      showToast(requestError.message, "error");
    } finally {
      setOperation("");
    }
  }

  function beginEdit(task) {
    setEditingId(task._id);
    setEditingForm({ title: task.title, description: task.description || "", priority: task.priority });
  }

  async function handleUpdate(event, id) {
    event.preventDefault();
    setOperation(`update-${id}`);
    setError("");
    try {
      const response = await updateTask(id, editingForm);
      setTasks((current) => current.map((task) => task._id === id ? response.task : task));
      setEditingId(null);
      showToast("Task updated successfully", "success");
    } catch (requestError) {
      setError(requestError.message);
      showToast(requestError.message, "error");
    } finally {
      setOperation("");
    }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setOperation(`delete-${task._id}`);
    setError("");
    try {
      await deleteTask(task._id);
      setTasks((current) => current.filter((item) => item._id !== task._id));
      showToast("Task deleted successfully", "success");
    } catch (requestError) {
      setError(requestError.message);
      showToast(requestError.message, "error");
    } finally {
      setOperation("");
    }
  }

  function showToast(message, type) {
    setToast({ message, type });
  }

  const completedCount = tasks.filter((task) => task.completed).length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">PRACTICAL 06 · FULL STACK LAB</p><h1>Task Desk</h1></div>
        <div className="connection"><span className="connection-dot" /> API connected <span className="port">:5000</span></div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy"><p className="kicker">React / Express / MongoDB</p><h2>Make the work<br /><em>move forward.</em></h2><p className="hero-note">A focused workspace for creating, tracking, and finishing the tasks that matter.</p></div>
        <div className="stat-strip"><div><strong>{tasks.length}</strong><span>Total tasks</span></div><div><strong>{completedCount}</strong><span>Completed</span></div><div><strong>{tasks.length - completedCount}</strong><span>In progress</span></div></div>
      </section>

      <section className="workspace">
        <div className="composer-panel">
          <div className="section-label"><span>01</span><h3>New task</h3></div>
          <form onSubmit={handleCreate} className="task-form">
            <label>Title<input name="title" value={form.title} onChange={(event) => updateForm(event, setForm)} placeholder="What needs doing?" required /></label>
            <label>Description<textarea name="description" value={form.description} onChange={(event) => updateForm(event, setForm)} placeholder="Add a little context..." rows="4" /></label>
            <label>Priority<select name="priority" value={form.priority} onChange={(event) => updateForm(event, setForm)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <button className="primary-button" disabled={operation === "create"}>{operation === "create" ? "Saving..." : "Add task +"}</button>
          </form>
        </div>

        <div className="list-panel">
          <div className="list-heading"><div className="section-label"><span>02</span><h3>Your tasks</h3></div><button className="refresh-button" onClick={loadTasks} disabled={loading} title="Refresh tasks">↻ Refresh</button></div>
          {error && <div className="error-banner">{error}</div>}
          {loading ? <div className="empty-state"><span className="loader" />Loading tasks from MongoDB...</div> : tasks.length === 0 ? <div className="empty-state"><strong>Nothing here yet.</strong><span>Create your first task to start the flow.</span></div> : <div className="task-list">{tasks.map((task) => <article className={`task-card ${task.completed ? "is-complete" : ""}`} key={task._id}>
            {editingId === task._id ? <form className="edit-form" onSubmit={(event) => handleUpdate(event, task._id)}><input name="title" value={editingForm.title} onChange={(event) => updateForm(event, setEditingForm)} required /><textarea name="description" value={editingForm.description} onChange={(event) => updateForm(event, setEditingForm)} rows="2" /><select name="priority" value={editingForm.priority} onChange={(event) => updateForm(event, setEditingForm)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><div className="edit-actions"><button className="primary-button" disabled={operation === `update-${task._id}`}>{operation === `update-${task._id}` ? "Saving..." : "Save changes"}</button><button type="button" className="quiet-button" onClick={() => setEditingId(null)}>Cancel</button></div></form> : <><div className="task-main"><span className={`priority-dot ${task.priority}`} /><div><h4>{task.title}</h4><p>{task.description || "No description added."}</p></div></div><div className="task-meta"><span className={`priority-badge ${task.priority}`}>{task.priority}</span><button className="text-button" onClick={() => beginEdit(task)}>Edit</button><button className="text-button danger" onClick={() => handleDelete(task)} disabled={operation === `delete-${task._id}`}>{operation === `delete-${task._id}` ? "Deleting..." : "Delete"}</button></div></>}
          </article>)}</div>}
        </div>
      </section>
      {toast && <div className={`toast ${toast.type}`}>{toast.type === "success" ? "✓" : "!"} {toast.message}</div>}
    </main>
  );
}

export default App;