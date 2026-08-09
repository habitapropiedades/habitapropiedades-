// Link de una propiedad para compartir (WhatsApp, Facebook, etc).
// Vercel expone esto en /api/p/<id>, y vercel.json lo reescribe a /p/<id>.
// Devuelve HTML con meta tags Open Graph (imagen + descripcion de ESA propiedad)
// para que las apps armen la vista previa, y redirige al visitante real al sitio.

// Si en Vercel configuraste las variables de entorno SUPABASE_URL / SUPABASE_KEY,
// esas tienen prioridad. Si no, usa estos valores fijos como respaldo.
var FALLBACK_SUPABASE_URL = 'https://sszgcvgeovrtlkcphdga.supabase.co';
var FALLBACK_SUPABASE_KEY = 'eyJhbGci••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';

// Limpia cualquier caracter que no sea ASCII imprimible (por ejemplo, si al
// copiar/pegar el codigo algun editor cambio una comilla o un guion por su
// version "elegante" de Unicode). Los headers HTTP no aceptan esos caracteres.
function toAsciiSafe(s) {
  return String(s == null ? '' : s).replace(/[^\x20-\x7E]/g, '');
}

var SUPABASE_URL = toAsciiSafe(process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL);
var SUPABASE_KEY = toAsciiSafe(process.env.SUPABASE_KEY || FALLBACK_SUPABASE_KEY);
var SITE_URL = 'https://www.sandraarano.com.ar';
var DEFAULT_IMAGE = SITE_URL + '/logo.png';

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

function getDrivePhotoUrl(fileId) {
  fileId = String(fileId).trim();
  if (fileId.indexOf('http') === 0) return fileId;
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
}

function getFirstPhoto(fotoField) {
  if (!fotoField) return null;
  var parts = String(fotoField).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  return parts.length ? getDrivePhotoUrl(parts[0]) : null;
}

function buildDescription(p) {
  var corta = (p.descripcion_corta || '').trim();
  if (corta) return corta;
  var bits = [p.tipo, p.zona ? ('en ' + p.zona) : '', p.precio].filter(Boolean);
  if (bits.length) return bits.join(' ');
  var larga = (p.descripcion || '').trim();
  if (larga) return larga.length > 160 ? larga.slice(0, 157).trim() + '...' : larga;
  return 'Conoce esta propiedad publicada por Sandra Arano Negocios Inmobiliarios.';
}

function renderPage(opts) {
  var t = escapeHtml(opts.title);
  var d = escapeHtml(opts.description);
  var img = escapeHtml(opts.image);
  var url = escapeHtml(opts.url);
  var redirectTo = opts.redirectTo;
  var redirectToEsc = escapeHtml(redirectTo);
  return '<!DOCTYPE html>' +
    '<html lang="es"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>' + t + '</title>' +
    '<meta name="description" content="' + d + '"/>' +
    '<link rel="canonical" href="' + url + '"/>' +
    '<meta property="og:type" content="website"/>' +
    '<meta property="og:url" content="' + url + '"/>' +
    '<meta property="og:title" content="' + t + '"/>' +
    '<meta property="og:description" content="' + d + '"/>' +
    '<meta property="og:image" content="' + img + '"/>' +
    '<meta property="og:locale" content="es_AR"/>' +
    '<meta name="twitter:card" content="summary_large_image"/>' +
    '<meta name="twitter:title" content="' + t + '"/>' +
    '<meta name="twitter:description" content="' + d + '"/>' +
    '<meta name="twitter:image" content="' + img + '"/>' +
    '<meta http-equiv="refresh" content="0;url=' + redirectToEsc + '"/>' +
    '</head><body>' +
    '<p>Redirigiendo a <a href="' + redirectToEsc + '">' + t + '</a>...</p>' +
    '<script>location.replace(' + JSON.stringify(redirectTo) + ');</script>' +
    '</body></html>';
}

function sendText(res, code, text) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}

function sendHtml(res, code, html) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  res.end(html);
}

function sendRedirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

module.exports = function (req, res) {
  var id;
  try {
    id = req.query && req.query.id;
    if (!id && req.url) {
      var m = req.url.match(/\/api\/p\/([^/?#]+)/) || req.url.match(/\/p\/([^/?#]+)/);
      if (m) id = decodeURIComponent(m[1]);
    }
  } catch (e0) {
    sendText(res, 200, 'ERROR leyendo el id: ' + (e0 && e0.message ? e0.message : String(e0)));
    return;
  }

  if (!id) {
    sendRedirect(res, SITE_URL + '/index.html');
    return;
  }

  var apiUrl = SUPABASE_URL + '/rest/v1/propiedades?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1';

  Promise.resolve()
    .then(function () {
      if (typeof fetch !== 'function') {
        throw new Error('fetch no esta disponible en este runtime');
      }
      return fetch(apiUrl, {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
      });
    })
    .then(function (supaRes) {
      if (!supaRes.ok) {
        return supaRes.text().then(function (bodyText) {
          throw new Error('Supabase respondio ' + supaRes.status + ': ' + bodyText.slice(0, 300));
        });
      }
      return supaRes.json();
    })
    .then(function (rows) {
      var p = rows && rows[0];
      if (!p) {
        sendRedirect(res, SITE_URL + '/index.html');
        return;
      }

      var title = (p.direccion || p.titulo || 'Propiedad') + ' | Sandra Arano Negocios Inmobiliarios';
      var description = buildDescription(p);
      var image = getFirstPhoto(p.fotos) || DEFAULT_IMAGE;
      var canonicalUrl = SITE_URL + '/p/' + encodeURIComponent(id);
      var redirectTo = SITE_URL + '/index.html#propiedad-' + encodeURIComponent(id);

      var html = renderPage({
        title: title,
        description: description,
        image: image,
        url: canonicalUrl,
        redirectTo: redirectTo
      });
      sendHtml(res, 200, html);
    })
    .catch(function (err) {
      sendText(res, 200, 'ERROR buscando la propiedad ' + id + ': ' + (err && err.stack ? err.stack : String(err)));
    });
};
