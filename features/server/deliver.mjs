// Delivery adapters for contact-form: deliver(message) -> Promise. message = { name, email, text, html } (html already escaped).
// They take an injected `doFetch` (the Web fetch signature), so tests pass a local fake and no real host is ever called.
// Secrets come only from the caller (read from environment variables there): RESEND_API_KEY, SUPABASE_SERVICE_KEY.
// Errors thrown here never include the key or the vendor response body.
//
// Email, Resend-style: POST https://api.resend.com/emails, headers Authorization: Bearer <key> and Content-Type: application/json,
//   JSON body { from, to: [..], subject, html, text, reply_to }. Source: https://resend.com/docs/api-reference/emails/send-email
//   read 2026-11-22 (endpoint, auth, field names and success { id } confirmed from that page). Real delivery: UNVERIFIED.
// Database, Supabase REST insert: POST <SUPABASE_URL>/rest/v1/<table> with apikey, Authorization: Bearer, Prefer: return=minimal.
//   https://supabase.com/docs/reference/javascript/insert was read 2026-11-22 but shows only the JS client, not the raw HTTP:
//   the exact request shape is UNVERIFIED (it is PostgREST's documented convention, not read today). Use the service key only on the server.
const need = (v, name) => { if (!v) throw new Error(`${name} is missing (set it as an environment variable)`); return v; };

async function resendSend(apiKey, doFetch, body) {
  const res = await doFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`email provider answered ${res.status}`);
}

export function emailAdapter({ apiKey, from, to, doFetch }) {
  need(apiKey, 'RESEND_API_KEY'); need(from, 'CONTACT_FROM'); need(to, 'CONTACT_TO'); need(doFetch, 'doFetch');
  return (m) => resendSend(apiKey, doFetch, { from, to: [to], subject: 'New message from your website', html: m.html, text: m.text, reply_to: m.email });
}

// Plain-text mailer for auth sign-in links: send({ to, subject, text }).
export function resendMailer({ apiKey, from, doFetch }) {
  need(apiKey, 'RESEND_API_KEY'); need(from, 'AUTH_FROM'); need(doFetch, 'doFetch');
  return { send: ({ to, subject, text }) => resendSend(apiKey, doFetch, { from, to: [to], subject, text }) };
}

export function supabaseAdapter({ url, serviceKey, table = 'contact_messages', doFetch }) {
  need(url, 'SUPABASE_URL'); need(serviceKey, 'SUPABASE_SERVICE_KEY'); need(doFetch, 'doFetch');
  if (!/^https:\/\//.test(url)) throw new Error('SUPABASE_URL must be https');
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new Error('bad table name');
  return async (m) => {
    const res = await doFetch(`${url.replace(/\/+$/, '')}/rest/v1/${table}`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ name: m.name, email: m.email, message: m.text }),
    });
    if (!res.ok) throw new Error(`database answered ${res.status}`);
  };
}
