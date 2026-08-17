import { corsify, handlePreflight, isAuthenticated, err, json, readJsonBody, getMessages, saveMessages, resolveJwtSecret } from '../../../_shared.js';
import { findById, softDelete, restore } from '../../../_messages.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));
  const req = context.request;
  if (!await isAuthenticated(req, secret)) return corsify(err('Unauthorized', 401));

  const id = context.params.id;

  try {
    if (req.method === 'GET') {
      const db = await getMessages(context.env);
      const m = findById(db.items || [], id);
      if (!m) return corsify(err('Message not found', 404));
      return corsify(json(m));
    }

    if (req.method === 'DELETE') {
      const db = await getMessages(context.env);
      const items = (db.items || []).slice();
      const r = softDelete(items, id);
      await saveMessages(context.env, { items: r.items });
      return corsify(json({ ok: true }));
    }

    return corsify(err('Method not allowed', 405));
  } catch (e) {
    return corsify(err(e.message, 400));
  }
}
