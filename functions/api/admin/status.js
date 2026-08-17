import { corsify, handlePreflight, verifyJwt, err, json, resolveJwtSecret } from '../../_shared.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));

  if (context.request.method === 'GET') {
    const auth = context.request.headers.get('authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return corsify(json({ authenticated: false }));
    const payload = await verifyJwt(secret, m[1]);
    if (!payload || payload.role !== 'admin') return corsify(json({ authenticated: false }));
    return corsify(json({ authenticated: true, username: payload.username }));
  }

  return corsify(err('Method not allowed', 405));
}
