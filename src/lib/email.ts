import nodemailer from "nodemailer";

async function transport() {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT || 587);
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM;
  if (!host || !user || !pass || !from || !Number.isFinite(port)) throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");
  return { client: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, requireTLS: port !== 465 }), from };
}

export async function sendVerificationCode(to: string, code: string) {
  const { client, from } = await transport();
  await client.sendMail({ from, to, subject: "Verify your AI Job Automation account", text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`, html: `<p>Your AI Job Automation verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes.</p>` });
}

export async function sendSecondFactorCode(to: string, code: string) {
  const { client, from } = await transport();
  await client.sendMail({ from, to, subject: "Your AI Job Automation sign-in code", text: `Your sign-in verification code is ${code}. It expires in 5 minutes. If you did not try to sign in, secure your account.`, html: `<p>Your sign-in verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 5 minutes.</p>` });
}
