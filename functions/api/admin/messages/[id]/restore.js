import { corsify, handlePreflight, isAuthenticated, err, json, getMessages, saveMessages, resolveJwtSecret } from '../../../../_shared.js';
import { restore } from '../../../../_messages.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));
  if (!await isAuthenticated(context.request, secret)) return corsify(err('Unauthorized', 401));
  if (context.request.method !== 'POST') return corsify(err('Method not allowed', 405));

  try {
    const id = context.params.id;
    const db = await getMessages(context.env);
    const items = (db.items || []).slice();
    const r = restore(items, id);
    await saveMessages(context.env, { items: r.items });
    return corsify(json(r.message));
  } catch (e) {
    return corsify(err(e.message, 400));
  }
}
