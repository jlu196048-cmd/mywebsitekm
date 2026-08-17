import { corsify, handlePreflight, isAuthenticated, err, json, resolveJwtSecret } from '../_shared.js';

export async function onRequest(context) {
  const pf = await handlePreflight(context.request);
  if (pf) return pf;

  const secret = resolveJwtSecret(context.env);
  if (!secret) return corsify(err('Server is missing JWT_SECRET. Set it in Pages → Environment variables.', 503));

  if (context.request.method === 'GET') {
    if (!context.env.MYWEBSITE_R2) return corsify(json({ items: [], note: 'R2 not bound — image listing disabled. Upload still works; URLs will be returned by the upload endpoint.' }));
    const list = await context.env.MYWEBSITE_R2.list();
    const items = list.objects.map(o => ({
      name: o.key,
      url: '/api/images/' + encodeURIComponent(o.key),
      size: o.size,
      ext: o.key.includes('.') ? '.' + o.key.split('.').pop() : ''
    }));
    return corsify(json({ items }));
  }

  if (context.request.method === 'POST') {
    if (!await isAuthenticated(context.request, secret)) return corsify(err('Unauthorized', 401));
    if (!context.env.MYWEBSITE_R2) return corsify(err('R2 binding not configured. Set MYWEBSITE_R2 in Pages settings to enable image upload.', 503));

    const ct = context.request.headers.get('content-type') || '';
    if (!ct.startsWith('multipart/form-data')) return corsify(err('Expected multipart/form-data', 400));

    const fd = await context.request.formData();
    const file = fd.get('file');
    if (!file || typeof file === 'string') return corsify(err('Missing file', 400));
    if (file.size > 8 * 1024 * 1024) return corsify(err('File too large (max 8 MB)', 400));

    const ext = (file.name && file.name.includes('.')) ? '.' + file.name.split('.').pop() : '.bin';
    const bytes = new Uint8Array(8); crypto.getRandomValues(bytes);
    const base = Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
    const key = base + ext;
    const buf = await file.arrayBuffer();
    await context.env.MYWEBSITE_R2.put(key, buf, {
      httpMetadata: { contentType: file.type }
    });
    return corsify(json({
      name: key,
      url: '/api/images/' + encodeURIComponent(key),
      size: file.size,
      ext
    }));
  }

  return corsify(err('Method not allowed', 405));
}
