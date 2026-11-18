type EmailProvider = "resend" | "postmark" | "sendgrid";
interface EmailMessage { from: string; to: string; subject: string; text: string; html: string; }
const timeout = () => AbortSignal.timeout(15000);
async function sendResend(message: EmailMessage) {
 const key = process.env.RESEND_API_KEY; if (!key) throw new Error("not configured");
 const response = await fetch("https://api.resend.com/emails", {
  method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
  body: JSON.stringify({ from: message.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }), signal: timeout()
 });
 if (!response.ok) throw new Error("Resend delivery failed");
}
async function sendPostmark(message: EmailMessage) {
 const key = process.env.POSTMARK_SERVER_TOKEN; if (!key) throw new Error("not configured");
 const response = await fetch("https://api.postmarkapp.com/email", {
  method: "POST", headers: { "X-Postmark-Server-Token": key, "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ From: message.from, To: message.to, Subject: message.subject, TextBody: message.text, HtmlBody: message.html }), signal: timeout()
 });
 if (!response.ok) throw new Error("Postmark delivery failed");
}
async function sendSendGrid(message: EmailMessage) {
 const key = process.env.SENDGRID_API_KEY; if (!key) throw new Error("not configured");
 const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
  method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
  body: JSON.stringify({ personalizations: [{ to: [{ email: message.to }] }], from: { email: message.from }, subject: message.subject,
   content: [{ type: "text/plain", value: message.text }, { type: "text/html", value: message.html }] }), signal: timeout()
 });
 if (!response.ok) throw new Error("SendGrid delivery failed");
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
  catch { /* Fail over without logging recipients, message bodies or provider credentials. */ }
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

export async function sendAccountRecoveryCode(to: string, code: string) {
 await sendEmail({ to, subject: "Your AI Job Automation account recovery code",
  text: "Your account recovery code is " + code + ". It expires in 10 minutes. If you did not request this, secure your email account and contact support.",
  html: "<p>Your account recovery code is:</p><p style=\\"font-size:28px;font-weight:bold;letter-spacing:6px\\">" + code + "</p><p>This code expires in 10 minutes.</p>" });
}

export async function sendPasswordResetLink(to: string, url: string) {
 await sendEmail({ to, subject: "Reset your AI Job Automation password",
  text: "Use this one-time link to reset your password: " + url + ". It expires in 15 minutes. If you did not request this, ignore this email.",
  html: "<p>Use this one-time link to reset your password:</p><p><a href=\\"" + url + "\\">Reset password</a></p><p>This link expires in 15 minutes. If you did not request this, ignore this email.</p>" });
}
