import { corsify, handlePreflight, readJsonBody, getPosts, savePosts, isAuthenticated, err, json, resolveJwtSecret } from '../../_shared.js';
import { listPosts, findPostById, createPost, updatePost, deletePost, togglePost } from '../../_posts.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));
  const req = context.request;
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());

  if (req.method === 'GET') {
    const items = await getPosts(context.env);
    const authed = await isAuthenticated(req, secret);
    return corsify(json(listPosts(items, params, authed)));
  }

  if (req.method === 'POST') {
    if (!await isAuthenticated(req, secret)) return corsify(err('Unauthorized', 401));
    const body = await readJsonBody(req);
    const items = await getPosts(context.env);
    const post = createPost(items, body, 'admin');
    await savePosts(context.env, { items: post.items });
    return corsify(json(post.post));
  }

  return corsify(err('Method not allowed', 405));
}
