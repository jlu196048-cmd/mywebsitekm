import { corsify, handlePreflight, json } from '../../_shared.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;
  // JWT is stateless — the client just deletes the token. Endpoint kept for API parity.
  if (context.request.method === 'POST') return corsify(json({ ok: true }));
  return corsify(json({ ok: true, message: 'No-op' }));
}
