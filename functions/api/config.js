// Public, non-sensitive client configuration. Returns whatever is safe to
// embed in a page (Turnstile site key, etc). The contact form reads this
// to decide whether to mount the Turnstile widget.

import { corsify, handlePreflight, json } from '../_shared.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  if (context.request.method !== 'GET') {
    return corsify(json({ message: 'Method not allowed' }, { status: 405 }));
  }

  const cfg = {
    turnstileSiteKey: context.env.TURNSTILE_SITE_KEY || '',
  };
  return corsify(json(cfg));
}