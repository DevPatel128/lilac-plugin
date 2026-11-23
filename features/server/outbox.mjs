// Development-only delivery: appends each message as one JSON line to a local file. Node only (uses node:fs), so it is
// NOT copied to Cloudflare/Vercel by `features.mjs add`. Never use it in production.
export function outboxAdapter({ path = './outbox.jsonl' } = {}) {
  return async (m) => {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(path, JSON.stringify({ at: new Date().toISOString(), name: m.name, email: m.email, text: m.text }) + '\n');
  };
}
