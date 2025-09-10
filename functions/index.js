try { require('dotenv').config(); } catch (_) {}
const path = require('path');
const { setGlobalOptions } = require('firebase-functions/v2');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');

setGlobalOptions({
  region: 'us-central1',
  serviceAccount: 'drive-sop-reader@avsecbwx-4229c.iam.gserviceaccount.com',
});

admin.initializeApp();

const KEYFILE = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? path.resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : null;

// ====== Konfigurasi Sheet per site ======
const SHEETS = {
  PSCP:  { id: '1qOd-uWNGIguR4wTj85R5lQQF3GhTFnHru78scoTkux8', gid: '0' },
  HBSCP: { id: '1qOd-uWNGIguR4wTj85R5lQQF3GhTFnHru78scoTkux8', gid: '1552839141' },
};

// ====== CORS ======
const ALLOWED_ORIGINS = [
  'https://n45pnasp.github.io',
  'https://avsecbwxapp.online',
  /^https?:\/\/localhost(?::\d+)?$/,
  /\.github\.io$/,
];
function allowOrigin(origin = '') {
  return ALLOWED_ORIGINS.some(p => (typeof p === 'string' ? p === origin : p.test(origin)));
}
function okCORS(req, res) {
  const origin = req.get('origin') || '';
  if (allowOrigin(origin)) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Expose-Headers', 'Content-Disposition, Accept-Ranges, Content-Range');
}
function preflight(req, res) {
  const origin = req.get('origin') || '';
  if (allowOrigin(origin)) res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Accept, Content-Type, Range');
  res.set('Access-Control-Max-Age', '3600');
  return res.status(204).send('');
}

// ====== Auth Google (Drive) ======
async function getServiceHeaders() {
  const auth = new GoogleAuth({
    keyFile: KEYFILE || undefined,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  return client.getRequestHeaders();
}

// ====== Helper ======
function makePdfFileName(site) {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  return `Plotting_${site}_${dateStr}.pdf`;
}

/* ========== downloadPdf (export Sheet -> PDF) ========== */
exports.downloadPdf = onRequest(async (req, res) => {
  if (req.method === 'OPTIONS') return preflight(req, res);
  okCORS(req, res);

  try {
    const authz = req.get('Authorization') || '';
    const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!idToken) return res.status(401).send('Missing Authorization token');
    await admin.auth().verifyIdToken(idToken);

    const site = String(req.query.site || '').toUpperCase();
    const meta = SHEETS[site];
    if (!meta) return res.status(400).send('Unknown site');

    const gHeaders = await getServiceHeaders();
    const query = new URLSearchParams({
      format: 'pdf', size: 'A4', portrait: 'true', scale: '2',
      top_margin: '0.50', bottom_margin: '0.50',
      left_margin: '0.50', right_margin: '0.50',
      sheetnames: 'false', printtitle: 'false',
      pagenumbers: 'true', gridlines: 'false', fzr: 'true',
      gid: meta.gid || '0',
    });
    const docsUrl = `https://docs.google.com/spreadsheets/d/${meta.id}/export?${query.toString()}`;
    const gRes = await fetch(docsUrl, { headers: gHeaders });
    if (!gRes.ok) {
      const txt = await gRes.text().catch(() => '');
      return res.status(500).send(`Docs export failed (${gRes.status}).\n${txt}`);
    }

    const buf = Buffer.from(await gRes.arrayBuffer());
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${makePdfFileName(site)}"`);
    return res.status(200).send(buf);
  } catch (e) {
    console.error('downloadPdf error:', e);
    return res.status(500).send(e?.message || 'Server error');
  }
});

