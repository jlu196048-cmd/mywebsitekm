import { corsify, handlePreflight, readJsonBody, getAdmin, saveAdmin, isAuthenticated, verifyPassword, hashPassword, err, json, resolveJwtSecret } from '../../_shared.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));
  if (!await isAuthenticated(context.request, secret)) return corsify(err('Unauthorized', 401));

  if (context.request.method === 'POST') {
    const body = await readJsonBody(context.request);
    const { currentPassword, newPassword } = body || {};
    if (!currentPassword || !newPassword) return corsify(err('Both passwords are required', 400));
    if (newPassword.length < 6) return corsify(err('New password must be at least 6 characters', 400));

    const admin = await getAdmin(context.env);

    const ok = await verifyPassword(currentPassword, admin.passwordHash);
    if (!ok) return corsify(err('Current password is incorrect', 400));

    const newHash = await hashPassword(newPassword);
    admin.passwordHash = newHash;
    admin.passwordRotated = true;
    await saveAdmin(context.env, admin);

    return corsify(json({ ok: true }));
  }

  return corsify(err('Method not allowed', 405));
}