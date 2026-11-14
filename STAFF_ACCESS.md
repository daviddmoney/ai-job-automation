# Staff-only administration

- Public registration always creates `USER` accounts. No browser input can assign the `STAFF` role.
- The `/admin` page calls the database-backed `requireStaff()` helper and redirects non-staff accounts.
- The current scaffold intentionally has no public staff-registration or self-promotion endpoint.
- Provision the initial staff account only through a controlled, audited database administration procedure after the user has verified their email. Do not expose a public endpoint that accepts a role value.
- Every future admin API and server action must call `requireStaff()` and write an audit event. Hiding an admin link in the UI is not authorization.
