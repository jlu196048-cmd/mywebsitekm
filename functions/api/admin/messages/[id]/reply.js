import { corsify, handlePreflight, isAuthenticated, err, json, readJsonBody, getMessages, saveMessages, resolveJwtSecret } from '../../../../_shared.js';
import { addReply } from '../../../../_messages.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));
  if (!await isAuthenticated(context.request, secret)) return corsify(err('Unauthorized', 401));
  if (context.request.method !== 'POST') return corsify(err('Method not allowed', 405));

  try {
    const id = context.params.id;
    const body = await readJsonBody(context.request);
    const username = (body && body.username) || 'admin';
    const db = await getMessages(context.env);
    const items = (db.items || []).slice();
    const r = addReply(items, id, body.body, username);
    await saveMessages(context.env, { items: r.items });
    return corsify(json(r.message));
  } catch (e) {
    return corsify(err(e.message, 400));
  }
}
