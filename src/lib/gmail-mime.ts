import { randomBytes } from "node:crypto";

function base64Url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeHeader(value: string) {
  return value.replace(/[\r\n]/g, " ").trim();
}

export function buildMimeMessage(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachment: { fileName: string; mimeType: string; content: Buffer };
}) {
  const boundary = "ajob_" + randomBytes(18).toString("hex");
  const filename = safeHeader(input.attachment.fileName).replace(/["\\]/g, "_");
  const lines = [
    "From: " + safeHeader(input.from),
    "To: " + safeHeader(input.to),
    "Subject: " + safeHeader(input.subject),
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
    "",
    "--" + boundary,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.body,
    "--" + boundary,
    "Content-Type: " + safeHeader(input.attachment.mimeType) + '; name="' + filename + '"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="' + filename + '"',
    "",
    input.attachment.content.toString("base64").replace(/.{1,76}/g, "$&\r\n").trimEnd(),
    "--" + boundary + "--",
    ""
  ];
  return base64Url(Buffer.from(lines.join("\r\n"), "utf8"));
}
