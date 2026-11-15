# Gmail integration setup

## Google Cloud
1. Select or create the Google Cloud project used by the deployment.
2. Enable the Gmail API.
3. Configure the OAuth consent screen with the app name, support email, authorized domains and privacy-policy details required for the deployment.
4. Create a Web application OAuth client.
5. Add `https://YOUR_DEPLOYED_HOST/api/gmail/callback` as an authorized redirect URI. It must exactly match `GOOGLE_GMAIL_REDIRECT_URI`.
6. Request the Gmail compose and send scopes. Google may require OAuth verification before external users can connect.

## Deployment environment
Set these server-side values in Railway (or the hosting provider):
- `GOOGLE_GMAIL_CLIENT_ID`
- `GOOGLE_GMAIL_CLIENT_SECRET`
- `GOOGLE_GMAIL_REDIRECT_URI`
- `TOTP_ENCRYPTION_KEY` (the existing base64-encoded 32-byte AES-256-GCM key)

Never put OAuth secrets in `NEXT_PUBLIC_*`, source files, GitHub Actions variables exposed to browser code, or committed files.

## First-time setup and use
1. Deploy the application and apply the `20261115090000_gmail_cv_attachments` Prisma migration.
2. Sign in and open Dashboard → Email and CV settings.
3. Connect the Gmail mailbox and approve the requested permissions.
4. Upload the user's PDF CV (up to 8 MB). The file is encrypted before it is stored.
5. Create or update a Gmail draft through the authenticated `/api/gmail/drafts` endpoint. The API fetches the selected user's PDF, constructs a multipart MIME message from the original bytes, writes the draft, and reads it back to verify a non-empty PDF attachment.
6. Send only after the user explicitly confirms the action through `/api/gmail/drafts/send`.

## API contract
- `GET /api/gmail/connect` starts OAuth for the signed-in account.
- `GET /api/gmail/callback` validates OAuth state and stores encrypted tokens.
- `POST /api/cv` accepts multipart form data with a `file` field.
- `GET /api/cv` returns metadata for the signed-in user's primary CV only.
- `POST /api/gmail/drafts` accepts `to`, `subject`, `body`, and optional `cvId`; the primary CV is used by default.
- `PATCH /api/gmail/drafts` accepts the same fields plus `draftId`; the CV is reattached on every update.
- `POST /api/gmail/drafts/send` accepts `draftId` and `confirmSend: true`. The API verifies the PDF attachment before sending.
- `POST /api/gmail/disconnect` revokes and removes the stored Gmail connection.

All data operations are scoped to the authenticated user. The application never exposes the stored CV bytes or OAuth tokens to the browser. Gmail sends remain a separate explicit action; creating or updating a draft does not send a message.

## Validation
The CI workflow runs the Gmail MIME regression tests, TypeScript checks, Prisma schema validation via database push, integration tests, and production build on this feature branch. A real OAuth callback and Gmail mailbox round-trip must still be exercised in a configured staging environment.
