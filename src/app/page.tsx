const features = [
  { icon: "⌕", title: "Global opportunity radar", description: "Discover roles across countries, industries and work arrangements, using the preferences you control." },
  { icon: "✦", title: "Career intelligence", description: "Bring your experience, goals and job preferences together to find more relevant opportunities." },
  { icon: "▤", title: "Intelligent CV studio", description: "Prepare and tailor career documents while keeping your original files available for review." },
  { icon: "↗", title: "Application command centre", description: "Organise opportunities, review next steps and keep every application journey visible." },
  { icon: "◎", title: "Human-approved automation", description: "Use automation with clear activity history and your approval before external submissions." },
  { icon: "文", title: "Multilingual by design", description: "Work across languages while retaining original vacancy text and reviewing AI translations." }
];

function Brand() {
  return <a className="brand" href="/" aria-label="AI Job Automation home"><span className="brand-mark">A</span><span>career<span className="gradient-text">/OS</span></span></a>;
}

export default function HomePage() {
  return <main>
    <div className="container">
      <header className="topbar">
        <Brand />
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#capabilities">Capabilities</a>
          <a href="#how-it-works">How it works</a>
          <a className="button" href="/signin">Sign in</a>
          <a className="button button-primary" href="/register">Get started <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="hero">
        <div>
          <span className="eyebrow"><span className="pulse" /> Your intelligent career workspace</span>
          <h1>Your next opportunity deserves <span className="gradient-text">a smarter system.</span></h1>
          <p className="hero-copy">Discover opportunities worldwide, prepare stronger applications and manage every next step in one thoughtful workspace — with you in control.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/register">Build your career workspace <span aria-hidden="true">→</span></a>
            <a className="button" href="/signin">Explore your workspace</a>
          </div>
          <p className="trust-line">Global discovery · Multilingual support · Human-approved actions</p>
        </div>

        <div className="preview-window" aria-label="Illustrative preview of the career workspace">
          <div className="preview-head"><span className="preview-dots"><i/><i/><i/></span><span>CAREER INTELLIGENCE / OVERVIEW</span><span>DESIGN PREVIEW</span></div>
          <div className="preview-card">
            <div className="preview-title"><span>Your opportunity landscape</span><span className="pill">Personalised</span></div>
            <div className="preview-sub">A clearer view of your next career move</div>
            <div className="preview-metrics">
              <div className="metric"><strong>01</strong><span>Discover</span></div>
              <div className="metric"><strong>02</strong><span>Review</span></div>
              <div className="metric"><strong>03</strong><span>Advance</span></div>
            </div>
            <div className="preview-title" style={{margin:"17px 0 5px"}}><span>Opportunity matches</span><span style={{color:"#9b8cff"}}>View all ↗</span></div>
            <div className="job-row"><div><strong style={{fontSize:12}}>Finance Analyst</strong><div className="job-company">Global organisation · Hybrid</div></div><span className="pill">Review match</span></div>
            <div className="job-row"><div><strong style={{fontSize:12}}>Operations Associate</strong><div className="job-company">Technology · Remote</div></div><span className="pill">New role</span></div>
            <div className="job-row"><div><strong style={{fontSize:12}}>Graduate Accountant</strong><div className="job-company">Professional services · On-site</div></div><span className="pill">Explore</span></div>
          </div>
        </div>
      </section>

      <section className="section" id="capabilities">
        <div className="section-heading"><span className="eyebrow">One connected experience</span><h2>Everything around your career, working together.</h2><p>Less fragmented searching. More clarity, thoughtful automation and control over the decisions that matter.</p></div>
        <div className="feature-grid">{features.map(feature => <article className="feature-card" key={feature.title}><span className="feature-icon" aria-hidden="true">{feature.icon}</span><h3>{feature.title}</h3><p>{feature.description}</p></article>)}</div>
      </section>

      <section className="section" id="how-it-works">
        <div className="section-heading"><span className="eyebrow">A calmer way forward</span><h2>Discover. Prepare. Approve. Progress.</h2><p>Your profile and preferences guide discovery. You review AI-assisted documents and approve external actions. Your application history stays organised in your workspace.</p></div>
        <a className="button button-primary" href="/register">Start building your workspace <span aria-hidden="true">→</span></a>
      </section>
      <footer className="site-footer"><Brand/><span>Designed for opportunity, built around your control.</span><span>© {new Date().getFullYear()} AI Job Automation</span></footer>
    </div>
  </main>;
}