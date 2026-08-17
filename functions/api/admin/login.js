import { corsify, handlePreflight, readJsonBody, getAdmin, issueJwt, verifyPassword, err, json, resolveJwtSecret } from '../../_shared.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));

  if (context.request.method === 'POST') {
    const body = await readJsonBody(context.request);
    const { username, password } = body || {};
    if (!username || !password) return corsify(err('Username and password are required', 400));

    const admin = await getAdmin(context.env);
    if (username !== admin.username) return corsify(err('Invalid credentials', 401));

    const ok = await verifyPassword(password, admin.passwordHash);
    if (!ok) return corsify(err('Invalid credentials', 401));
    const token = await issueJwt(secret, { role: 'admin', username });
    return corsify(json({ token, username, passwordRotated: !!admin.passwordRotated }));
  }

  return corsify(err('Method not allowed', 405));
}
