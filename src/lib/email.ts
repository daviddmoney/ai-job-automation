import nodemailer from "nodemailer";

export async function sendVerificationCode(to: string, code: string) {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT || 587);
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM;
  if (!host || !user || !pass || !from || !Number.isFinite(port)) {
    throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    requireTLS: port !== 465
  });

  await transport.sendMail({
    from,
    to,
    subject: "Verify your AI Job Automation account",
    text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your AI Job Automation verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`
  });
}
