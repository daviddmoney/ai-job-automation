const features = [
  { title: "Lagos-only opportunities", description: "Prioritise newly published vacancies whose stated work location is Lagos, including clearly identified Lagos hybrid and remote roles." },
  { title: "Private job profile", description: "Keep your CV, experience, saved opportunities, and application history isolated to your own account." },
  { title: "Application tracking", description: "Organise opportunities by status and keep notes, deadlines, and next steps in one workspace." },
  { title: "Human approval", description: "Review each tailored application before anything is submitted or sent on your behalf." }
];

export default function HomePage() {
  return <main style={{ maxWidth: 1040, margin: "0 auto", padding: "72px 24px" }}>
    <div style={{ display: "inline-block", padding: "7px 12px", borderRadius: 999, background: "#e8eefc", color: "#24458b", fontSize: 13, fontWeight: 700 }}>PRIVATE SAAS WORKSPACE</div>
    <h1 style={{ fontSize: "clamp(40px, 7vw, 64px)", lineHeight: 1.05, letterSpacing: "-0.04em", margin: "22px 0 18px" }}>Find the right Lagos opportunity. Manage every next step.</h1>
    <p style={{ maxWidth: 700, fontSize: 19, lineHeight: 1.7, color: "#596579" }}>AI Job Automation is being built as a secure, multi-user platform for discovering relevant jobs, preparing applications, and tracking progress — with your personal information kept private.</p>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 44 }}>
      {features.map((feature) => <article key={feature.title} style={{ background: "white", border: "1px solid #e5e9f0", borderRadius: 16, padding: 22 }}><h2 style={{ fontSize: 18, margin: "0 0 10px" }}>{feature.title}</h2><p style={{ color: "#596579", lineHeight: 1.65, margin: 0 }}>{feature.description}</p></article>)}
    </section>
    <p style={{ marginTop: 42, color: "#788397", fontSize: 13 }}>Development scaffold · Authentication, database, job integrations, and deployment are not yet configured.</p>
  </main>;
}
