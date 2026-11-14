import { createHash, createHmac } from "node:crypto";
export type TranslationProvider = "google" | "deepl" | "azure" | "aws" | "openai";
export interface TranslationInput { text: string; sourceLanguage?: string; targetLanguage: string; }
export interface TranslationResult { translatedText: string; provider: TranslationProvider; sourceLanguage: string; targetLanguage: string; }
const headers = { "Content-Type": "application/json", Accept: "application/json" };
const timeout = () => AbortSignal.timeout(20000);
async function google(input: TranslationInput) {
 const key = process.env.GOOGLE_TRANSLATE_API_KEY; if (!key) throw new Error("not configured");
 const body: Record<string, unknown> = { q: input.text, target: input.targetLanguage, format: "text" };
 if (input.sourceLanguage && input.sourceLanguage !== "auto") body.source = input.sourceLanguage;
 const res = await fetch("https://translation.googleapis.com/language/translate/v2", { method: "POST", headers: { ...headers, "x-goog-api-key": key }, body: JSON.stringify(body), signal: timeout() });
 if (!res.ok) throw new Error("Google Translation failed");
 const data = await res.json() as { data?: { translations?: Array<{ translatedText?: string }> } };
 const text = data.data?.translations?.[0]?.translatedText; if (!text) throw new Error("Empty Google translation"); return text;
}
async function deepl(input: TranslationInput) {
 const key = process.env.DEEPL_API_KEY; if (!key) throw new Error("not configured");
 const base = process.env.DEEPL_API_BASE_URL || (key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");
 const body: Record<string, unknown> = { text: [input.text], target_lang: input.targetLanguage.toUpperCase() };
 if (input.sourceLanguage && input.sourceLanguage !== "auto") body.source_lang = input.sourceLanguage.toUpperCase();
 const res = await fetch(base + "/v2/translate", { method: "POST", headers: { ...headers, Authorization: "DeepL-Auth-Key " + key }, body: JSON.stringify(body), signal: timeout() });
 if (!res.ok) throw new Error("DeepL failed");
 const data = await res.json() as { translations?: Array<{ text?: string }> };
 const text = data.translations?.[0]?.text; if (!text) throw new Error("Empty DeepL translation"); return text;
}
async function azure(input: TranslationInput) {
 const key = process.env.AZURE_TRANSLATOR_KEY; const region = process.env.AZURE_TRANSLATOR_REGION;
 if (!key || !region) throw new Error("not configured");
 const params = new URLSearchParams({ "api-version": "3.0", to: input.targetLanguage });
 if (input.sourceLanguage && input.sourceLanguage !== "auto") params.set("from", input.sourceLanguage);
 const res = await fetch("https://api.cognitive.microsofttranslator.com/translate?" + params, { method: "POST",
  headers: { ...headers, "Ocp-Apim-Subscription-Key": key, "Ocp-Apim-Subscription-Region": region },
  body: JSON.stringify([{ Text: input.text }]), signal: timeout() });
 if (!res.ok) throw new Error("Azure Translator failed");
 const data = await res.json() as Array<{ translations?: Array<{ text?: string }> }>;
 const text = data[0]?.translations?.[0]?.text; if (!text) throw new Error("Empty Azure translation"); return text;
}
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value, "utf8").digest();
async function aws(input: TranslationInput) {
 const access = process.env.AWS_ACCESS_KEY_ID; const secret = process.env.AWS_SECRET_ACCESS_KEY;
 const region = process.env.AWS_TRANSLATE_REGION || process.env.AWS_REGION;
 if (!access || !secret || !region || !input.sourceLanguage || input.sourceLanguage === "auto") throw new Error("not configured or explicit source language required");
 const host = "translate." + region + ".amazonaws.com";
 const target = "AWSShineFrontendService_20170701.TranslateText";
 const body = JSON.stringify({ Text: input.text, SourceLanguageCode: input.sourceLanguage, TargetLanguageCode: input.targetLanguage });
 const now = new Date(); const amzDate = now.toISOString().replace(/[:-]|\\.\\d{3}/g, ""); const date = amzDate.slice(0, 8);
 const canonicalHeaders = "content-type:application/x-amz-json-1.1\nhost:" + host + "\nx-amz-date:" + amzDate + "\nx-amz-target:" + target + "\n";
 const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
 const canonical = ["POST", "/", "", canonicalHeaders, signedHeaders, hash(body)].join("\n");
 const scope = date + "/" + region + "/translate/aws4_request";
 const toSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + hash(canonical);
 const kDate = hmac("AWS4" + secret, date); const kRegion = hmac(kDate, region); const kService = hmac(kRegion, "translate"); const kSigning = hmac(kService, "aws4_request");
 const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
 const token = process.env.AWS_SESSION_TOKEN;
 const res = await fetch("https://" + host + "/", { method: "POST", headers: {
  "Content-Type": "application/x-amz-json-1.1", "X-Amz-Date": amzDate, "X-Amz-Target": target,
  Authorization: "AWS4-HMAC-SHA256 Credential=" + access + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature,
  ...(token ? { "X-Amz-Security-Token": token } : {})
 }, body, signal: timeout() });
 if (!res.ok) throw new Error("AWS Translate failed");
 const data = await res.json() as { TranslatedText?: string }; if (!data.TranslatedText) throw new Error("Empty AWS translation"); return data.TranslatedText;
}
async function openai(input: TranslationInput) {
 const key = process.env.OPENAI_API_KEY; if (!key) throw new Error("not configured");
 const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { ...headers, Authorization: "Bearer " + key },
  body: JSON.stringify({ model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o-mini", temperature: 0,
   messages: [
    { role: "system", content: "Translate the supplied text accurately into the requested language. Preserve names, dates, numbers, qualifications, job titles, legal meaning and professional terminology. Do not add facts or commentary. Return only the translation." },
    { role: "user", content: "Target language: " + input.targetLanguage + "\nSource language: " + (input.sourceLanguage || "auto-detect") + "\n\nText:\n" + input.text }
   ] }), signal: timeout() });
 if (!res.ok) throw new Error("OpenAI translation failed");
 const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
 const text = data.choices?.[0]?.message?.content?.trim(); if (!text) throw new Error("Empty OpenAI translation"); return text;
}
const adapters: Record<TranslationProvider, (input: TranslationInput) => Promise<string>> = { google, deepl, azure, aws, openai };
const configured = (p: TranslationProvider) => p === "google" ? Boolean(process.env.GOOGLE_TRANSLATE_API_KEY)
 : p === "deepl" ? Boolean(process.env.DEEPL_API_KEY)
 : p === "azure" ? Boolean(process.env.AZURE_TRANSLATOR_KEY && process.env.AZURE_TRANSLATOR_REGION)
 : p === "aws" ? Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && (process.env.AWS_TRANSLATE_REGION || process.env.AWS_REGION))
 : Boolean(process.env.OPENAI_API_KEY);
export async function translateText(input: TranslationInput): Promise<TranslationResult> {
 if (!input.text.trim() || input.text.length > 12000) throw new Error("TRANSLATION_TEXT_INVALID");
 if (!/^[a-zA-Z-]{2,20}$/.test(input.targetLanguage) || (input.sourceLanguage && !/^[a-zA-Z-]{2,20}$/.test(input.sourceLanguage))) throw new Error("TRANSLATION_LANGUAGE_INVALID");
 const order = (process.env.TRANSLATION_PROVIDER_ORDER || "google,deepl,azure,aws,openai").split(",").map(x => x.trim().toLowerCase()).filter((x): x is TranslationProvider => ["google","deepl","azure","aws","openai"].includes(x));
 const tried: string[] = [];
 for (const provider of [...new Set(order)]) {
  if (!configured(provider)) continue;
  tried.push(provider);
  try { return { translatedText: await adapters[provider](input), provider, sourceLanguage: input.sourceLanguage || "auto", targetLanguage: input.targetLanguage }; }
  catch { /* Provider fallback: never log user content, provider bodies or credentials. */ }
 }
 throw new Error(tried.length ? "TRANSLATION_PROVIDERS_UNAVAILABLE" : "TRANSLATION_NOT_CONFIGURED");
}