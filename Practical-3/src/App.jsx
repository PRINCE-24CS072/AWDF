import { useEffect, useMemo, useState } from "react";
import "./App.css";

const fallbackRepos = [
  { id: 1, name: "portfolio-lab", description: "A responsive portfolio built while exploring component-driven UI.", language: "JavaScript", stargazers_count: 8, forks_count: 2, updated_at: "2026-08-12T00:00:00Z", html_url: "https://github.com/" },
  { id: 2, name: "task-manager-api", description: "A small REST API for practicing Express middleware and CRUD routes.", language: "JavaScript", stargazers_count: 5, forks_count: 1, updated_at: "2026-08-09T00:00:00Z", html_url: "https://github.com/" },
  { id: 3, name: "data-notes", description: "Short experiments and notes from learning data structures in Python.", language: "Python", stargazers_count: 3, forks_count: 0, updated_at: "2026-07-28T00:00:00Z", html_url: "https://github.com/" },
];

const languageColors = { JavaScript: "#e5b84b", Python: "#4b9cbd", TypeScript: "#4788c7", CSS: "#d26b90", HTML: "#df7655" };

function formatDate(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function App() {
  const [username, setUsername] = useState("PrincePatel");
  const [activeUser, setActiveUser] = useState("PrincePatel");
  const [profile, setProfile] = useState(null);
  const [repos, setRepos] = useState(fallbackRepos);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("All languages");
  const [sort, setSort] = useState("recent");
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

  const languages = useMemo(() => ["All languages", ...new Set(repos.map((repo) => repo.language).filter(Boolean))], [repos]);
  const visibleRepos = useMemo(() => repos.filter((repo) => {
    const matchesQuery = `${repo.name} ${repo.description || ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (language === "All languages" || repo.language === language);
  }).sort((a, b) => sort === "stars" ? b.stargazers_count - a.stargazers_count : new Date(b.updated_at) - new Date(a.updated_at)), [repos, query, language, sort]);

  const submitSearch = (event) => { event.preventDefault(); const next = username.trim().replace(/^@/, ""); if (next) setActiveUser(next); };
  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);

  return (
    <main className="atlas-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Repository Atlas home"><span className="brand-mark">RA</span><span>Repository Atlas</span></a>
        <form className="profile-search" onSubmit={submitSearch}>
          <span className="search-icon">/</span><input value={username} onChange={(event) => setUsername(event.target.value)} aria-label="GitHub username" placeholder="GitHub username" /><button type="submit">Load profile</button>
        </form>
      </header>

      <section className="intro-row">
        <div><p className="eyebrow">PUBLIC WORK / {status === "loading" ? "SYNCING" : "LIVE INDEX"}</p><h1>Build a clearer picture<br />of your <em>code.</em></h1><p className="intro-copy">A focused view of projects, experiments, and the work in between.</p></div>
        <div className="date-stamp"><span>ATLAS / 03</span><strong>{new Date().getFullYear()}</strong></div>
      </section>

      <section className="workspace">
        <aside className="profile-panel">
          <div className="avatar-wrap">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{activeUser.slice(0, 2).toUpperCase()}</span>}</div>
          <p className="profile-label">Developer profile</p><h2>{profile?.name || activeUser}</h2><p className="handle">@{activeUser}</p>
          <p className="bio">{profile?.bio || "A personal index of things made, tested, and learned."}</p>
          <div className="profile-facts"><span>Repositories <b>{profile?.public_repos || repos.length}</b></span><span>Stars gathered <b>{totalStars}</b></span><span>Followers <b>{profile?.followers || 0}</b></span></div>
          <a className="profile-link" href={profile?.html_url || `https://github.com/${activeUser}`} target="_blank" rel="noreferrer">View GitHub profile <span>↗</span></a>
        </aside>

        <section className="repo-area">
          <div className="repo-heading"><div><p className="eyebrow">PROJECT INDEX</p><h2>Selected repositories <sup>{visibleRepos.length}</sup></h2></div><p className="sync-note">{status === "fallback" ? "Showing local preview data" : `Updated ${formatDate(new Date())}`}</p></div>
          <div className="filters"><label className="filter-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" /></label><select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Filter by language">{languages.map((item) => <option key={item}>{item}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort repositories"><option value="recent">Recently updated</option><option value="stars">Most starred</option></select></div>
          {status === "loading" ? <div className="state-box">Indexing profile...</div> : visibleRepos.length ? <div className="repo-grid">{visibleRepos.map((repo) => <article className="repo-card" key={repo.id}><div className="card-top"><span className="repo-type">REPOSITORY</span><a href={repo.html_url} target="_blank" rel="noreferrer" aria-label={`Open ${repo.name}`}>↗</a></div><h3>{repo.name}</h3><p>{repo.description || "No description added yet."}</p><div className="card-meta"><span><i style={{ background: languageColors[repo.language] || "#9c9a91" }} />{repo.language || "Unspecified"}</span><span>★ {repo.stargazers_count}</span><span>⑂ {repo.forks_count}</span></div><footer>Updated {formatDate(repo.updated_at)}</footer></article>)}</div> : <div className="state-box">No repositories match these filters.</div>}
        </section>
      </section>
    </main>
  );
}

export default App;
