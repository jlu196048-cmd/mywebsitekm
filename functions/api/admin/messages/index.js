import { corsify, handlePreflight, isAuthenticated, err, json, getMessages, resolveJwtSecret } from '../../../_shared.js';
import { listMessages } from '../../../_messages.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));
  if (!await isAuthenticated(context.request, secret)) return corsify(err('Unauthorized', 401));

  if (context.request.method !== 'GET') return corsify(err('Method not allowed', 405));

  try {
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || 'all';
    const db = await getMessages(context.env);
    const result = listMessages(db.items || [], { status });
    return corsify(json(result));
  } catch (e) {
    return corsify(err(e.message, 400));
  }
}
