# Security Review

Review date: 2026-11-19

## Finding summary

| Severity | Area | Status |
|---|---|---|
| High | Cloud-boundary masking missed conversation history and Nano-to-cloud fallback prompts | Fixed |
| Low | Profile UI did not explicitly state that localStorage is unencrypted | Fixed |
| Low | Package metadata did not declare the Apache 2.0 license | Fixed |

## High: incomplete cloud masking

### Status

Fixed.

The cloud request now applies `sanitizeForCloud()` inside `runAI()` immediately before `generateContent()`. This sanitizes the complete constructed prompt, including:

- The current note or prompt
- Recent conversation history
- Task and application context
- Nano-to-cloud fallback prompts

The cloud response result also carries the masking summary and count back to the UI.

### Remaining risk

Masking is pattern-based. It may miss names, physical addresses, usernames, alphanumeric identifiers, unusually formatted phone numbers, or secrets embedded in free text. It is not a substitute for formal data-loss prevention or server-side policy enforcement.

## UI privacy clarification

The Profile dialog now states that:

- Notes and profile values are stored unencrypted in browser `localStorage`
- Private mode controls AI routing rather than encrypting stored data
- Clearing browser data removes the local backup

## Strong areas

- `.env` is excluded from Git
- No committed API secret or service-account credential was found
- Firebase web API keys are treated as client configuration
- Private/offline routes refuse cloud-only tasks
- Same-origin service-worker handling does not intercept cross-origin Firebase calls
- Markdown and user-visible strings use escaping or text nodes
- The README documents local-storage and best-effort-redaction limitations

## Recommended production follow-up

- Configure and enforce Firebase App Check in the Firebase project
- Add server-side or provider-level authorization and usage controls
- Consider more robust secret and identifier detection before cloud transmission
- Add automated tests for complete-prompt masking and Nano fallback behavior
