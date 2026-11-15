# Multilingual and translation architecture

## Translation providers
The server-side gateway supports Google Cloud Translation, DeepL, Microsoft Azure Translator, Amazon Translate (AWS Signature Version 4) and OpenAI. Configure one or more credentials. TRANSLATION_PROVIDER_ORDER controls fallback. Provider failures do not expose user text or credentials in logs.

## User preferences
UserJobPreference stores interface, native, job-description, application and employer-communication language preferences separately, plus additional languages. Job-search country, region, city and work-mode preferences are also per-user.

## Requirements
- Detect source language where supported and permit a user override.
- Preserve original vacancy content and source language.
- Translate job descriptions, CVs, cover letters and messages only through explicit user actions or clearly disclosed workflows.
- Keep original and translated text distinguishable.
- Require human review before sending applications or employer messages.
- Preserve names, dates, amounts, qualifications, certifications and technical terminology.
- Support Unicode and plan right-to-left UI layouts for Arabic.
- Never claim a translation is certified or legally authoritative.
- Obtain clear consent before sending private CVs or messages to external translation providers.

## API
POST /api/translate requires an authenticated session, same-origin request and per-user rate limit. It accepts up to 12,000 characters and a target language code. Results are marked for human review.

## Privacy and resilience
Keep credentials server-side. Send only minimum required text. Review provider data-processing terms, residency and retention before production use. Fallback improves availability but must not change requested language or user intent.
