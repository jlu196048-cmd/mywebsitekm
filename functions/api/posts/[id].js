import { corsify, handlePreflight, readJsonBody, getPosts, savePosts, isAuthenticated, err, json, resolveJwtSecret } from '../../_shared.js';
import { findPostById, updatePost, deletePost, togglePost } from '../../_posts.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));
  const req = context.request;
  const id = context.params.id;

  if (req.method === 'GET') {
    const items = await getPosts(context.env);
    const p = findPostById(items, id);
    if (!p) return corsify(err('Post not found', 404));
    const authed = await isAuthenticated(req, secret);
    if (p.status !== 'published' && !authed) return corsify(err('Post not found', 404));
    return corsify(json(p));
  }

  if (!await isAuthenticated(req, secret)) return corsify(err('Unauthorized', 401));

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    const items = await getPosts(context.env);
    const r = updatePost(items, id, body);
    await savePosts(context.env, { items: r.items });
    return corsify(json(r.post));
  }

  if (req.method === 'DELETE') {
    const items = await getPosts(context.env);
    const r = deletePost(items, id);
    await savePosts(context.env, { items: r.items });
    return corsify(json({ ok: true }));
  }

  return corsify(err('Method not allowed', 405));
}
