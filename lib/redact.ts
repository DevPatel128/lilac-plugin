// Redaction for anything persisted or shown: run records, traces, mistakes, sandbox output. Pure.
import { SECRET } from './secret.ts';

const GLOBAL = new RegExp(SECRET.source, 'g');
const ASSIGN = /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*)\s*[=:]\s*("[^"]*"|'[^']*'|\S+)/gi;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Wider shapes (security review M-8). Each is a heuristic: names, street addresses and free-form personal facts are NOT redacted.
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----|$)/g; // whole block; an unterminated one runs to the end
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g; // header.payload.signature
const URL_USER = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi; // scheme://user:password@host
const AWS_ID = /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g;
const HEADER = /\b(x-api-key|x-auth-token|api-key|apikey|authorization|proxy-authorization)\s*:\s*[^\n]+/gi;
const PROSE_PW = /\b(password|passwd|pwd|passphrase)\s*(?:is|was|=|:)\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi; // "password is X", "passwd: X", "pwd=X"
const LONG_SECRET = /\b((?:secret|key|token|credential)s?\b[\w ]{0,20}?)\s*[=:]?\s*["']?((?=[A-Za-z0-9+/_-]*\d)[A-Za-z0-9+/_-]{32,}={0,2})["']?/gi; // 32+ char hex or base64 next to key/secret/token
const CARD = /\b(?:\d[ -]?){15,18}\d\b/g; // 16-19 digits; only a Luhn-valid number is redacted
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE = /(?<![\w+])\+[1-9]\d{7,14}\b|\b\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g; // E.164, and US 3-3-4
const luhn = (digits: string): boolean => { let sum = 0, dbl = false; for (let i = digits.length - 1; i >= 0; i--) { let d = +digits[i]; if (dbl && (d *= 2) > 9) d -= 9; sum += d; dbl = !dbl; } return sum % 10 === 0; };

/**
 * Replace secrets, credentials, card/SSN/phone numbers and email addresses with markers, THEN cut to `max` characters
 * (so a secret cannot be left half-visible by the cut). Callers that truncate their own fields must scrub the whole field first.
 * @param s text that may hold tool output or user input
 * @param max longest result kept (default 4000)
 * @returns the redacted text
 */
export function scrub(s: string | undefined | null, max = 4000): string {
  if (!s) return '';
  return String(s).replace(PRIVATE_KEY, '[REDACTED:private-key]').replace(JWT, '[REDACTED:secret]').replace(URL_USER, '$1[REDACTED]@')
    .replace(GLOBAL, '[REDACTED:secret]').replace(AWS_ID, '[REDACTED:secret]').replace(HEADER, '$1: [REDACTED]')
    .replace(ASSIGN, '$1=[REDACTED]').replace(PROSE_PW, '$1=[REDACTED]').replace(LONG_SECRET, '$1 [REDACTED]').replace(BEARER, '$1 [REDACTED]')
    .replace(CARD, (m) => (luhn(m.replace(/\D/g, '')) ? '[REDACTED:card]' : m)).replace(SSN, '[REDACTED:ssn]').replace(PHONE, '[REDACTED:phone]')
    .replace(EMAIL, '[REDACTED:email]').slice(0, max);
}

/** True when the text still looks like it holds a secret (used to block artifact export). */
export const hasSecret = (s: string): boolean => SECRET.test(s) || /\b(?:SECRET|TOKEN|PASSWORD|API_KEY)\s*=\s*(?!\[REDACT)\S{8,}/i.test(s);
