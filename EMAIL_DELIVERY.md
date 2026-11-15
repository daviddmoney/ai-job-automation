# Email delivery

The application sends account-verification and sign-in second-factor codes through a server-side email gateway.

Supported HTTP API providers:
- Resend: RESEND_API_KEY
- Postmark: POSTMARK_SERVER_TOKEN
- SendGrid: SENDGRID_API_KEY

Set EMAIL_FROM to a verified sender identity and EMAIL_PROVIDER_ORDER to a comma-separated failover order. Configure at least one provider credential. The gateway sends only the minimum verification message, uses a timeout, fails over to another configured provider and never logs recipient addresses, message content or credentials.

Nodemailer/SMTP is intentionally not used in this application because the installed Auth.js version declares an optional peer range that excludes the patched Nodemailer 10.x release line. Do not force an unsupported Nodemailer version or bypass npm peer-dependency resolution. The Auth.js credentials provider does not require Nodemailer; if an Auth.js email sign-in provider is added later, use its supported HTTP sendVerificationRequest flow.
