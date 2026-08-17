import { corsify, handlePreflight, readJsonBody, getMessages, saveMessages, err, json } from '../_shared.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  if (context.request.method === 'POST') {
    const body = await readJsonBody(context.request);
    const name = (body.name || '').toString().slice(0, 200);
    const email = (body.email || '').toString().slice(0, 200);
    const message = (body.message || '').toString().slice(0, 4000);
    if (!name || !email || !message) return corsify(err('All fields are required', 400));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return corsify(err('Invalid email', 400));

    // Optional Cloudflare Turnstile verification. Only enforced when
    // TURNSTILE_SECRET_KEY is configured as a Pages environment variable.
    const secret = context.env.TURNSTILE_SECRET_KEY;
    const token = (body || {})['cf-turnstile-response'];
    if (secret) {
      if (!token) return corsify(err('Captcha is required', 400));
      try {
        const fd = new URLSearchParams();
        fd.set('secret', secret);
        fd.set('response', String(token));
        const ip = context.request.headers.get('cf-connecting-ip');
        if (ip) fd.set('remoteip', ip);
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: fd,
        });
        const data = await r.json();
        if (!data || !data.success) return corsify(err('Captcha verification failed', 400));
      } catch (e) {
        return corsify(err('Captcha verification unavailable', 502));
      }
    }

    const list = await getMessages(context.env);
    list.items = list.items || [];
    const bytes = new Uint8Array(4); crypto.getRandomValues(bytes);
    const id = Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
    list.items.push({
      id, receivedAt: new Date().toISOString(),
      name, email, message,
      ip: context.request.headers.get('cf-connecting-ip') || '',
      read: false, deleted: false, replies: [],
    });
    if (list.items.length > 200) list.items = list.items.slice(-200);
    await saveMessages(context.env, list);

    return corsify(json({ ok: true }));
  }

  return corsify(err('Method not allowed', 405));
}
