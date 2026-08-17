import { corsify, handlePreflight, isAuthenticated, err, resolveJwtSecret } from '../../_shared.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));

  if (context.request.method === 'GET') {
    if (!context.env.MYWEBSITE_R2) return corsify(err('R2 not bound', 503));
    const name = context.params.name;
    const obj = await context.env.MYWEBSITE_R2.get(name);
    if (!obj) return corsify(err('Not found', 404));
    const headers = new Headers();
    if (obj.httpMetadata && obj.httpMetadata.contentType) headers.set('Content-Type', obj.httpMetadata.contentType);
    headers.set('Cache-Control', 'public, max-age=3600');
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(obj.body, { status: 200, headers });
  }

  if (context.request.method === 'DELETE') {
    if (!await isAuthenticated(context.request, secret)) return corsify(err('Unauthorized', 401));
    if (!context.env.MYWEBSITE_R2) return corsify(err('R2 not bound', 503));
    const name = context.params.name;
    await context.env.MYWEBSITE_R2.delete(name);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return corsify(err('Method not allowed', 405));
}
