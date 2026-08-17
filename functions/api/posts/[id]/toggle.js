import { corsify, handlePreflight, getPosts, savePosts, isAuthenticated, err, json, resolveJwtSecret } from '../../../_shared.js';
import { togglePost } from '../../../_posts.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));
  if (!await isAuthenticated(context.request, secret)) return corsify(err('Unauthorized', 401));

  if (context.request.method === 'POST') {
    const id = context.params.id;
    const items = await getPosts(context.env);
    const r = togglePost(items, id);
    if (!r.post) return corsify(err('Post not found', 404));
    await savePosts(context.env, { items: r.items });
    return corsify(json(r.post));
  }

  return corsify(err('Method not allowed', 405));
}
