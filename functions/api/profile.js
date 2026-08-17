import { corsify, handlePreflight, readJsonBody, getProfile, saveProfile, isAuthenticated, err, json, resolveJwtSecret } from '../_shared.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  if (context.request.method === 'GET') {
    return corsify(json(await getProfile(context.env)));
  }

  if (context.request.method === 'PUT') {
    const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));
    if (!await isAuthenticated(context.request, secret)) return corsify(err('Unauthorized', 401));
    const body = await readJsonBody(context.request);
    const cur = await getProfile(context.env);
    const next = Object.assign({}, cur, body, {
      intro: Object.assign({}, cur.intro, body.intro || {}),
      about: Object.assign({}, cur.about, body.about || {}),
    });
    if (!Array.isArray(next.contacts)) next.contacts = cur.contacts || [];
    await saveProfile(context.env, next);
    return corsify(json(next));
  }

  return corsify(err('Method not allowed', 405));
}
