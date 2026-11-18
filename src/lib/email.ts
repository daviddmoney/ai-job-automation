type EmailProvider = "resend" | "postmark" | "sendgrid";
interface EmailMessage { from: string; to: string; subject: string; text: string; html: string; }
const timeout = () => AbortSignal.timeout(15000);

async function providerFailure(response: Response, provider: EmailProvider): Promise<Error> {
 let code = "provider_rejected_request";
 try {
  const body: unknown = await response.json();
  if (body && typeof body === "object") {
   const record = body as Record<string, unknown>;
   const candidate = [record.name, record.code, record.ErrorCode].find(value => typeof value === "string" || typeof value === "number");
   if (candidate !== undefined) {
    const safe = String(candidate);
    if (/^[A-Za-z0-9_.-]{1,60}$/.test(safe)) code = safe;
   }
  }
 } catch { /* Provider returned a non-JSON error body. */ }
 const error = new Error(provider + " rejected email request");
 Object.assign(error, { provider, providerStatus: response.status, providerCode: code });
 return error;
}

async function sendResend(message: EmailMessage) {
 const key = process.env.RESEND_API_KEY; if (!key) throw new Error("not configured");
 const response = await fetch("https://api.resend.com/emails", {
  method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
  body: JSON.stringify({ from: message.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }), signal: timeout()
 });
 if (!response.ok) throw await providerFailure(response, "resend");
}
async function sendPostmark(message: EmailMessage) {
 const key = process.env.POSTMARK_SERVER_TOKEN; if (!key) throw new Error("not configured");
 const response = await fetch("https://api.postmarkapp.com/email", {
  method: "POST", headers: { "X-Postmark-Server-Token": key, "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ From: message.from, To: message.to, Subject: message.subject, TextBody: message.text, HtmlBody: message.html }), signal: timeout()
 });
 if (!response.ok) throw await providerFailure(response, "postmark");
}
async function sendSendGrid(message: EmailMessage) {
 const key = process.env.SENDGRID_API_KEY; if (!key) throw new Error("not configured");
 const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
  method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
  body: JSON.stringify({ personalizations: [{ to: [{ email: message.to }] }], from: { email: message.from }, subject: message.subject,
   content: [{ type: "text/plain", value: message.text }, { type: "text/html", value: message.html }] }), signal: timeout()
 });
 if (!response.ok) throw await providerFailure(response, "sendgrid");
}
const senders: Record<EmailProvider, (message: EmailMessage) => Promise<void>> = { resend: sendResend, postmark: sendPostmark, sendgrid: sendSendGrid };
function configured(provider: EmailProvider) {
 return provider === "resend" ? Boolean(process.env.RESEND_API_KEY) : provider === "postmark" ? Boolean(process.env.POSTMARK_SERVER_TOKEN) : Boolean(process.env.SENDGRID_API_KEY);
}
async function sendEmail(message: Omit<EmailMessage, "from">) {
 const from = process.env.EMAIL_FROM;
 if (!from) throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");
 const order = (process.env.EMAIL_PROVIDER_ORDER || "resend,postmark,sendgrid").split(",").map(x => x.trim().toLowerCase()).filter((x): x is EmailProvider => ["resend","postmark","sendgrid"].includes(x));
 const tried: string[] = [];
 for (const provider of [...new Set(order)]) {
  if (!configured(provider)) continue;
  tried.push(provider);
  try { await senders[provider]({ ...message, from }); return; }
  catch (error) {
   const detail = error && typeof error === "object" ? error as { providerStatus?: number; providerCode?: string } : {};
   // Never log recipient addresses, message bodies, OTPs, API credentials or raw provider responses.
   console.error("[email] provider delivery failed", {
    provider,
    status: detail.providerStatus ?? null,
    code: detail.providerCode ?? (error instanceof Error && error.name === "TimeoutError" ? "timeout" : "request_failed")
   });
  }
 }
 throw new Error(tried.length ? "EMAIL_PROVIDERS_UNAVAILABLE" : "EMAIL_DELIVERY_NOT_CONFIGURED");
}
export async function sendVerificationCode(to: string, code: string) {
 await sendEmail({ to, subject: "Verify your AI Job Automation account",
  text: "Your verification code is " + code + ". It expires in 10 minutes. If you did not request this, ignore this email.",
  html: "<p>Your AI Job Automation verification code is:</p><p style=\"font-size:28px;font-weight:bold;letter-spacing:6px\">" + code + "</p><p>This code expires in 10 minutes.</p>" });
}
export async function sendSecondFactorCode(to: string, code: string) {
 await sendEmail({ to, subject: "Your AI Job Automation sign-in code",
  text: "Your sign-in verification code is " + code + ". It expires in 5 minutes. If you did not try to sign in, secure your account.",
  html: "<p>Your sign-in verification code is:</p><p style=\"font-size:28px;font-weight:bold;letter-spacing:6px\">" + code + "</p><p>This code expires in 5 minutes.</p>" });
}
