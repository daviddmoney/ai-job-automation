import { requireUser } from "@/lib/server-auth";

const navigation = [
  { href: "/dashboard", icon: "⌂", label: "Overview" },
  { href: "/jobs", icon: "⌕", label: "Discover jobs" },
  { href: "/saved-jobs", icon: "♡", label: "Saved opportunities" },
  { href: "/applications", icon: "▤", label: "My applications" },
  { href: "/settings/job-preferences", icon: "◎", label: "Career preferences" },
  { href: "/settings/email", icon: "✉", label: "CV & Gmail" },
  { href: "/security/2fa", icon: "◇", label: "Security" }
];

export default async function DashboardPage() {
  const user = await requireUser();
  const initial = (user.email || "U").slice(0, 1).toUpperCase();
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/"><span className="brand-mark">A</span><span>career<span className="gradient-text">/OS</span></span></a>
      <div className="side-label">Workspace</div>
      <nav className="side-nav" aria-label="Workspace navigation">
        {navigation.map((item, index) => <a href={item.href} className={index === 0 ? "active" : undefined} key={item.href}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</a>)}
        {user.role === "STAFF" && <><div className="side-label">Administration</div><a href="/admin"><span className="nav-icon" aria-hidden="true">⚙</span>Staff workspace</a></>}
      </nav>
      <div className="sidebar-bottom">Your career workspace<br/><span style={{color:"var(--muted-2)"}}>Private to your account</span></div>
    </aside>
    <main className="workspace">
      <header className="workspace-top">
        <div><p>YOUR CAREER WORKSPACE</p><h1>Overview</h1></div>
        <div className="avatar" aria-label="Signed-in account">{initial}</div>
      </header>

      <section className="welcome-panel">
        <span className="eyebrow"><span className="pulse"/> YOUR NEXT MOVE STARTS HERE</span>
        <h2 style={{marginTop:17}}>Welcome to your career command centre.</h2>
        <p>Your opportunities, career preferences and application journey have a home. Start with a focused search or fine-tune what the platform looks for.</p>
        <div className="welcome-actions"><a className="button button-primary" href="/jobs">Discover opportunities <span aria-hidden="true">→</span></a><a className="button" href="/settings/job-preferences">Refine my preferences</a></div>
      </section>

      <section className="stat-grid" aria-label="Workspace overview">
        <article className="stat-card"><span>Career profile</span><strong>Personal</strong><small>Your account and preferences</small></article>
        <article className="stat-card"><span>Job discovery</span><strong>Global</strong><small>Based on your selected locations</small></article>
        <article className="stat-card"><span>Application control</span><strong>Yours</strong><small>Review before external actions</small></article>
        <article className="stat-card"><span>Language support</span><strong>Multi</strong><small>Originals retained for review</small></article>
      </section>

      <div className="workspace-grid">
        <section className="panel">
          <h3>Your next steps</h3><p className="panel-sub">A few useful places to continue building momentum.</p>
          <a className="quick-link" href="/jobs"><span className="feature-icon">⌕</span><span><strong>Explore global opportunities</strong><small>Search by role, country and work arrangement</small></span></a>
          <a className="quick-link" href="/settings/job-preferences"><span className="feature-icon">◎</span><span><strong>Personalise your career preferences</strong><small>Choose locations, job types and languages</small></span></a>
          <a className="quick-link" href="/applications"><span className="feature-icon">▤</span><span><strong>Review your application journey</strong><small>Keep your progress and next actions organised</small></span></a>
          <a className="quick-link" href="/settings/email"><span className="feature-icon">✉</span><span><strong>Prepare your CV and Gmail workspace</strong><small>Manage your private CV and email connection</small></span></a>
        </section>
        <aside className="panel">
          <h3>AI with you in control</h3><p className="panel-sub">Automation should make work easier without taking decisions away from you.</p>
          <div className="notice">Review AI-generated documents and translations before using them. External applications and messages require your explicit approval.</div>
          <div style={{marginTop:18}}><a className="action-link" href="/settings/job-preferences">Configure your preferences ↗</a></div>
          <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid var(--line)"}}><span style={{color:"var(--muted)",fontSize:10}}>SIGNED IN ACCOUNT</span><p style={{fontSize:12,overflowWrap:"anywhere"}}>{user.email}</p></div>
        </aside>
      </div>
    </main>
  </div>;
}