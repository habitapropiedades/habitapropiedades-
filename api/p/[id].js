// Link de una propiedad para compartir (WhatsApp, Facebook, etc).
// Vercel expone esto en /api/p/<id>, y vercel.json lo reescribe a /p/<id>.
// Devuelve HTML con meta tags Open Graph (imagen + descripcion de ESA propiedad)
// para que las apps armen la vista previa, y redirige al visitante real al sitio.
//
// Usa el modulo nativo "https" (en vez de fetch) porque el runtime de Node
// que usa este proyecto en Vercel no tiene fetch global disponible.

const https = require('https');

const SUPABASE_URL = 'https://sszgcvgeovrtlkcphdga.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzemdjdmdlb3ZydGxrY3BoZGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDU2MDAsImV4cCI6MjA5OTIyMTYwMH0.WZw8ky2e8fb1ratLyaAQir2lqYv0gDhxDwbLVNbXQpc';
const SITE_URL = 'https://www.sandraarano.com.ar';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Supabase respondio ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('timeout consultando Supabase')));
  });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function getDrivePhotoUrl(fileId) {
  fileId = String(fileId).trim();
  if (fileId.startsWith('http')) return fileId;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
}

function getFirstPhoto(fotoField) {
  if (!fotoField) return null;
  const first = String(fotoField).split(',').map(s => s.trim()).filter(Boolean)[0];
  return first ? getDrivePhotoUrl(first) : null;
}

function buildDescription(p) {
  const corta = (p.descripcion_corta || '').trim();
  if (corta) return corta;
  const bits = [p.tipo, p.zona && `en ${p.zona}`, p.precio].filter(Boolean);
  if (bits.length) return bits.join(' ');
  const larga = (p.descripcion || '').trim();
  if (larga) return larga.length > 160 ? larga.slice(0, 157).trim() + '...' : larga;
  return 'Conocé esta propiedad publicada por Sandra Arano Negocios Inmobiliarios.';
}

function renderPage({ title, description, image, url, redirectTo }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${t}</title>
<meta name="description" content="${d}"/>
<link rel="canonical" href="${escapeHtml(url)}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${escapeHtml(url)}"/>
<meta property="og:title" content="${t}"/>
<meta property="og:description" content="${d}"/>
<meta property="og:image" content="${escapeHtml(image)}"/>
<meta property="og:locale" content="es_AR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${t}"/>
<meta name="twitter:description" content="${d}"/>
<meta name="twitter:image" content="${escapeHtml(image)}"/>
<meta http-equiv="refresh" content="0;url=${escapeHtml(redirectTo)}"/>
<script>window.location.replace(${JSON.stringify(redirectTo)});</script>
</head>
<body>
<p>Redirigiendo a <a href="${escapeHtml(redirectTo)}">${t}</a>...</p>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id) {
    res.writeHead(302, { Location: `${SITE_URL}/index.html` });
    res.end();
    return;
  }

  try {
    const rows = await fetchJson(
      `${SUPABASE_URL}/rest/v1/propiedades?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
      { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    );
    const p = rows[0];

    if (!p) {
      res.writeHead(302, { Location: `${SITE_URL}/index.html` });
      res.end();
      return;
    }

    const title = `${p.direccion || p.titulo || 'Propiedad'} | Sandra Arano Negocios Inmobiliarios`;
    const description = buildDescription(p);
    const image = getFirstPhoto(p.fotos) || DEFAULT_IMAGE;
    const canonicalUrl = `${SITE_URL}/p/${encodeURIComponent(id)}`;
    const redire
