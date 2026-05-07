# CONTINUITY.md — whatsapp-pi attachment feature

## PLAN
- Add `send_wa_attachment` tool to send files (images, videos, audio, documents) via WhatsApp.
- Acceptance: tool is LLM-callable, validates file existence/size, resolves MIME/kind, sends to the **correct JID** (not a guessed one), records to recents, and does not produce a feedback loop on multi-device sync echoes.
- ✅ Done.

## DECISIONS
- `[2026-05-07]` JID is always explicit (required param). No `lastRemoteJid` default — avoids race condition with multiple customers on business number.
- `[2026-05-07]` No URL input in v1. File path only — tighter trust boundary.
- `[2026-05-07]` 100 MB attachment cap (WhatsApp practical limit).
- `[2026-05-07]` π suffix appended to captions (image/video/document). Audio has no caption field.
- `[2026-05-07]` Generalized `MessageSender` to accept `OutgoingContent` union.
- `[2026-05-07, supersedes earlier decision]` Tools accept `recipient` (digits / +number / full JID), NOT a raw JID. WhatsAppService maintains a `jidByDigits` registry populated from every allow-listed incoming message. `resolveKnownJid()` returns the canonical JID (including `@lid`) observed for that party. Tools call this resolver; falling back to `@s.whatsapp.net` only if nothing is known, and surfacing a warning in the tool result when the fallback is used. [CODE verified in live test]
- `[2026-05-07]` `WhatsAppService.extractText` now also reads captions from `imageMessage`, `videoMessage`, and `documentMessage`. Without this, the π loop-prevention check is blind to media captions and fromMe media echoes leak into the agent as new incoming messages. [CODE verified in live test]

## PROGRESS
- ✅ Phase 1: Types (`OutgoingContent`, `OutgoingKind`) + `MessageSender` generalization
- ✅ Phase 2: `attachment.helper.ts` (MIME map, kind resolution, file validation)
- ✅ Phase 3: `WhatsAppService.sendAttachment()` + `send_wa_attachment` tool
- ✅ Phase 4: Tests (now 129 passing, +10 since phase 3 baseline)
- ✅ Phase 5 (bug fixes found in live test):
  - JID registry + `resolveKnownJid` on `WhatsAppService`
  - `extractText` caption-aware (π loop prevention works for media now)
  - Tools now take `recipient` instead of raw `jid`, resolve internally, warn on fallback

## DISCOVERIES
- `[2026-05-07, USER-reported]` Live test: attachment was delivered to `207563001962646@s.whatsapp.net` (a ghost chat), not `207563001962646@lid` (the real Steven chat). Root cause: `whatsapp-pi.ts` incoming callback strips the JID domain via `remoteJid.split('@')[0]` before logging, so the LLM only ever sees the digits and guesses the domain when constructing the outbound JID. For business accounts, the LID is NOT the phone number — Steven's phone is `+61411417997`, his LID is `207563001962646`.
- `[2026-05-07, USER-reported]` Live test: sent attachments came back as incoming messages. Root cause: `WhatsAppService.extractText` only inspects `conversation` and `extendedTextMessage.text`, so captions with the π suffix were invisible to `isPiGeneratedMessage` — the loop-prevention check always returned false for media messages. fromMe echoes passed through.
- `[2026-05-07]` Pre-existing test failures in `incoming-media.service.test.ts` and `recents.service.test.ts` — Windows-style backslash expectations vs Linux forward slashes. Not introduced by this work.

## OUTCOMES
- Files modified: `whatsapp.types.ts`, `message.sender.ts`, `whatsapp.service.ts`, `whatsapp-pi.ts`. New files: `attachment.helper.ts`, `attachment.helper.test.ts`, `send-wa-attachment.tool.test.ts`, and updates to `message.sender.test.ts`, `send-wa-message.tool.test.ts`, `whatsapp.service.test.ts`.
- Not yet verified in live test after fixes: the specific JID resolution path. Next live test should confirm:
  1. Attachment delivered to the same chat as the text reply (no ghost chat).
  2. No document "echo" appearing as a new incoming message.
