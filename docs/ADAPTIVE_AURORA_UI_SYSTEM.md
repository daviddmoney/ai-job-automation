# Adaptive Aurora UI/UX System

Version 1.0 · Product: AI Job Automation · Status: foundation implementation

## Product experience
A global, multilingual career workspace that combines opportunity discovery, career preparation and application management. AI assistance is transparent; users retain control over external submissions and communications.

## Visual language
- Midnight foundation: #080B14 and #0D1220.
- Aurora accents: electric violet #9B8CFF and cyan #61D9EE.
- Positive state: emerald #67E3B0; caution: amber #F4C778.
- Surfaces use restrained translucency, fine borders and layered depth.
- Typography uses system sans-serif fallbacks; no remote font dependency.
- Motion is subtle and respects prefers-reduced-motion.
- Layouts prioritise readable content, keyboard navigation and responsive behaviour.

## Navigation model
Public: Home, Capabilities, How it works, Sign in, Register.
Authenticated: Overview, Discover jobs, Saved opportunities, Applications, Career preferences, CV & Gmail, Security. Staff-only administration remains role-gated.

## Interaction principles
1. Never imply that illustrative metrics are live data.
2. Keep original vacancy content when translations are generated.
3. Require review of AI-generated application content.
4. Require explicit user approval before external submission or messaging.
5. Keep user records private and enforce server-side authorisation.
6. Avoid duplicate applications and make automation activity auditable.
7. Use responsive navigation and layouts at mobile, tablet and desktop breakpoints.
8. Respect reduced-motion preferences and visible focus states.

## Implementation scope in v1
- Establish global visual tokens and responsive primitives.
- Refresh the public landing page and authenticated overview.
- Preserve existing routes, authentication, data access and server-side permission checks.
- Do not invent live analytics or claim features are operational when only foundations exist.

## Follow-on UI work
- Convert jobs, saved jobs, applications, preferences, CV/Gmail, sign-in, registration and staff administration screens to shared components.
- Add real profile completion, job match explanations and application metrics only when backed by stored data.
- Add localisation to every screen and ensure the language switcher preserves original job text.
- Add accessible form validation, loading, empty, error and success states.
- Validate with keyboard-only, screen-reader, mobile viewport and cross-browser tests.

## Production gate
A visual refresh is not production approval. Require CI, dependency and security checks, database migration review and staging validation, authentication and tenant-isolation tests, provider/OAuth verification, backups and restore rehearsal, monitoring, and a documented rollback plan before launch.
