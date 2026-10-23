import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function Home() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states for creating task
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [filter, setFilter] = useState('all');

  // Practical 13: AI Assistant states
  const [draftId, setDraftId] = useState(() => 'draft_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null); // { type: 'success' | 'fallback' | 'rate-limit' | 'error', message: string }
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  // Auth form state
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Fetch live tasks from MongoDB backend API
  const fetchTasks = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.status === 401) {
        handleLogout();
        setError('Session expired. Please log in again.');
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setTasks(data);
      } else {
        setError(data.error || 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Cannot connect to MongoDB backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTasks();
    }
  }, [token]);

  // Auth handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const payload = authMode === 'login' 
      ? { email: authEmail, password: authPassword }
      : { name: authName, email: authEmail, password: authPassword };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.details ? data.details.map(d => d.message).join(', ') : data.error;
        setError(msg || 'Authentication failed');
        return;
      }

      if (authMode === 'register') {
        setAuthMode('login');
        setError('Registration successful! Please log in.');
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      }
    } catch (err) {
      setError('Network error connecting to auth service.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setTasks([]);
  };

  // Practical 13: Generate AI task description via backend Gemini endpoint
  const handleGenerateDescription = async () => {
    if (!title.trim()) {
      setAiStatus({
        type: 'error',
        message: 'Please enter a task title first to generate an AI description.',
      });
      return;
    }

    // Overwrite safeguard: alert user if they have already typed a custom description
    if (description.trim()) {
      const confirmReplace = window.confirm(
        'You have already entered a description. Replace it with the AI-generated suggestion?'
      );
      if (!confirmReplace) return;
    }

    setAiLoading(true);
    setAiStatus(null);

    try {
      const res = await fetch(`${API_BASE}/ai/generate-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          draftId,
        }),
      });

      if (res.status === 401) {
        handleLogout();
        setError('Session expired. Please log in again.');
        return;
      }

      if (res.status === 429) {
        const rateData = await res.json();
        setAiStatus({
          type: 'rate-limit',
          message:
            rateData.error ||
            'Rate limit exceeded. You can only generate one AI description per task every 60 seconds.',
        });
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setAiStatus({
          type: 'error',
          message: data.error || 'Failed to generate AI description.',
        });
        return;
      }

      if (data.fallback) {
        setAiStatus({
          type: 'fallback',
          message:
            data.message ||
            'AI description generation is temporarily unavailable. You can write the description manually.',
        });
        return;
      }

      if (data.description) {
        setDescription(data.description);
        setIsAiGenerated(true);
        setAiStatus({
          type: 'success',
          message: 'AI description generated! Review and edit before saving.',
        });
      }
    } catch (err) {
      setAiStatus({
        type: 'fallback',
        message:
          'Could not reach AI service. Please verify your connection or write the description manually.',
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Create Task in MongoDB via backend API
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, description, priority })
      });

      const data = await res.json();
      if (res.ok) {
        setTasks([data, ...tasks]);
        setTitle('');
        setDescription('');
        setPriority('medium');
        setIsAiGenerated(false);
        setAiStatus(null);
        setDraftId('draft_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now());
      } else {
        setError(data.error || 'Failed to create task');
      }
    } catch (err) {
      setError('Error creating task in MongoDB.');
    }
  };

  // Toggle Status in MongoDB via backend API
  const handleToggleStatus = async (task) => {
    const nextStatus = task.status === 'pending' ? 'in-progress' : task.status === 'in-progress' ? 'completed' : 'pending';

    try {
      const res = await fetch(`${API_BASE}/tasks/${task._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          status: nextStatus,
          priority: task.priority
        })
      });

      const updated = await res.json();
      if (res.ok) {
        setTasks(tasks.map(t => t._id === task._id ? updated : t));
      } else {
        setError(updated.error || 'Failed to update task status');
      }
    } catch (err) {
      setError('Error updating task in MongoDB.');
    }
  };

  // Delete Task in MongoDB via backend API
  const handleDeleteTask = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setTasks(tasks.filter(t => t._id !== id));
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete task');
      }
    } catch (err) {
      setError('Error deleting task from MongoDB.');
    }
  };

  const filteredTasks = filter === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filter);

  // If user is not logged in, render JWT Authentication View
  if (!token) {
    return (
      <div className="home-container" style={{ maxWidth: '450px', margin: '2rem auto' }}>
        <div className="card">
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            {authMode === 'login' ? 'Sign In to TaskFlow' : 'Create an Account'}
          </h2>

          {error && (
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid var(--danger)', borderRadius: '0.375rem', color: '#fca5a5', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter your name"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="input-field"
                placeholder="email@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              {authMode === 'login' ? 'Log In' : 'Register'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {authMode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setAuthMode('register'); setError(''); }}>
                  Register here
                </button>
              </p>
            ) : (
              <p>
                Already registered?{' '}
                <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setAuthMode('login'); setError(''); }}>
                  Log in here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Task Management Dashboard</h1>
          <p>Welcome back, <strong>{user?.name || user?.email}</strong> — Connected to Live MongoDB Database</p>
        </div>
        <button className="btn btn-danger" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
          Log Out
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid var(--danger)', borderRadius: '0.375rem', color: '#fca5a5', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div className="grid">
        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Create New Task in MongoDB</h2>
          <form onSubmit={handleCreateTask}>
            <div className="form-group">
              <label>Task Title</label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter task title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <label style={{ margin: 0 }}>Description</label>
                <button
                  type="button"
                  className="btn btn-ai"
                  onClick={handleGenerateDescription}
                  disabled={aiLoading || !title.trim()}
                  title={!title.trim() ? 'Enter a task title first' : 'Generate description using Google Gemini'}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.65rem',
                    gap: '0.35rem',
                  }}
                >
                  {aiLoading ? (
                    <>
                      <span className="spinner-mini" /> Generating description...
                    </>
                  ) : (
                    <>
                      ✨ Generate Description
                    </>
                  )}
                </button>
              </div>
              <textarea
                className="input-field"
                rows="3"
                placeholder="Enter task description or use AI generation..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
              />

              {/* Exact required disclaimer when description is populated/generated by AI */}
              {isAiGenerated && (
                <div className="ai-disclaimer">
                  <span>🤖</span> AI-generated suggestion. Review and edit before saving.
                </div>
              )}

              {/* Non-blocking feedback for success, rate limiting, fallback, or error */}
              {aiStatus && (
                <div className={`ai-alert ai-alert-${aiStatus.type}`}>
                  <span>{aiStatus.type === 'fallback' ? 'ℹ️' : aiStatus.type === 'rate-limit' ? '⏳' : aiStatus.type === 'error' ? '⚠️' : '✅'}</span>
                  <span>{aiStatus.message}</span>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select
                className="input-field"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Add Task to Database
            </button>
          </form>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Live MongoDB Tasks ({filteredTasks.length})</h2>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {['all', 'pending', 'in-progress', 'completed'].map((f) => (
                <button
                  key={f}
                  className={`btn ${filter === f ? 'btn-primary' : ''}`}
                  onClick={() => setFilter(f)}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', textTransform: 'capitalize' }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              Fetching tasks from MongoDB...
            </p>
          ) : filteredTasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No tasks found in MongoDB database for this account. Create one using the form!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredTasks.map((task) => (
                <div
                  key={task._id}
                  style={{
                    backgroundColor: '#0f172a',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>{task.title}</h3>
                    {task.description && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {task.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <span className={`badge badge-${task.status}`}>{task.status}</span>
                      <span className="badge" style={{ backgroundColor: '#334155' }}>
                        {task.priority}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn"
                      onClick={() => handleToggleStatus(task)}
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', backgroundColor: '#334155', color: '#fff' }}
                    >
                      Status
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteTask(task._id)}
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
