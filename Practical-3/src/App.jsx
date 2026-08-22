import { useEffect, useMemo, useState } from "react";
import "./App.css";

const fallbackRepos = [
  { id: 1, name: "portfolio-lab", description: "A responsive portfolio built while exploring component-driven UI.", language: "JavaScript", stargazers_count: 8, forks_count: 2, updated_at: "2026-08-12T00:00:00Z", html_url: "https://github.com/" },
  { id: 2, name: "task-manager-api", description: "A small REST API for practicing Express middleware and CRUD routes.", language: "JavaScript", stargazers_count: 5, forks_count: 1, updated_at: "2026-08-09T00:00:00Z", html_url: "https://github.com/" },
  { id: 3, name: "data-notes", description: "Short experiments and notes from learning data structures in Python.", language: "Python", stargazers_count: 3, forks_count: 0, updated_at: "2026-07-28T00:00:00Z", html_url: "https://github.com/" },
];

function formatDate(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function App() {
  const [username, setUsername] = useState("PRINCE-24CS072");
  const [activeUser, setActiveUser] = useState("PRINCE-24CS072");
  const [profile, setProfile] = useState(null);
  const [repos, setRepos] = useState(fallbackRepos);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setStatus("loading");
      try {
        const [profileResponse, repoResponse] = await Promise.all([
          fetch(`https://api.github.com/users/${activeUser}`),
          fetch(`https://api.github.com/users/${activeUser}/repos?sort=updated&per_page=100`),
        ]);
        if (!profileResponse.ok || !repoResponse.ok) throw new Error("GitHub profile unavailable");
        const nextProfile = await profileResponse.json();
        const nextRepos = await repoResponse.json();
        if (!cancelled) { setProfile(nextProfile); setRepos(nextRepos); setStatus("ready"); }
      } catch {
        if (!cancelled) { setProfile(null); setRepos(fallbackRepos); setStatus("fallback"); }
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [activeUser]);

  const visibleRepos = useMemo(() => [...repos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)), [repos]);

  const submitSearch = (event) => { event.preventDefault(); const next = username.trim().replace(/^@/, ""); if (next) setActiveUser(next); };
  return (
    <main className="atlas-shell">
      <section className="profile-panel">
        <div className="profile-content">
          <div className="avatar-wrap">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{activeUser.slice(0, 2).toUpperCase()}</span>}</div>
          <div><h2>{profile?.name || activeUser}</h2><p className="handle">@{activeUser}</p><p className="bio">{profile?.bio || "GitHub developer profile"}</p></div>
          <div className="profile-stats"><span><b>{profile?.public_repos || repos.length}</b> repositories</span><span><b>{profile?.followers || 0}</b> followers</span><span><b>{profile?.following || 0}</b> following</span></div>
        </div>
      </section>

      <section className="repo-area">
        <div className="repo-heading"><h1>All repositories</h1><p className="sync-note">{status === "fallback" ? "Preview data" : `${visibleRepos.length} repositories`}</p></div>
        {status === "loading" ? <div className="state-box">Loading...</div> : visibleRepos.length ? <div className="repo-list">{visibleRepos.map((repo) => <article className="repo-item" key={repo.id}><h2>{repo.name}</h2><p className="repo-stars">★ {repo.stargazers_count} stars</p></article>)}</div> : <div className="state-box">No repositories found.</div>}
      </section>
    </main>
  );
}

export default App;
