// Meta Conversions API – Al Villaggio dei Bambini
// Riceve gli eventi dal sito (tramite Google Tag Manager) e li inoltra a Meta lato server.
// Variabili d'ambiente da impostare su Netlify (Project configuration → Environment variables):
//   META_PIXEL_ID         ID del dataset/pixel Meta
//   META_CAPI_TOKEN       token di accesso della Conversions API (NON metterlo nel codice)
//   META_TEST_EVENT_CODE  (facoltativo) codice "Test events" di Events Manager, da togliere a test finiti
//   META_API_VERSION      (facoltativo) versione Graph API, predefinita v23.0

import { createHash } from 'node:crypto';

const ALLOWED_EVENTS = new Set(['Lead', 'Contact', 'PageView', 'FindLocation']);

const sha256 = (v) => createHash('sha256').update(v).digest('hex');

const normEmail = (v) => (v || '').trim().toLowerCase();
const normName = (v) => (v || '').trim().toLowerCase();
const normPhone = (v) => {
  let d = (v || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  // numero italiano senza prefisso internazionale (cellulare 3xx o fisso 0xx)
  if (/^[03]\d{7,10}$/.test(d)) d = '39' + d;
  return d;
};
const hashed = (v) => (v ? [sha256(v)] : undefined);

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const { META_PIXEL_ID, META_CAPI_TOKEN, META_TEST_EVENT_CODE } = process.env;
  const version = process.env.META_API_VERSION || 'v23.0';
  if (!META_PIXEL_ID || !META_CAPI_TOKEN) {
    console.error('Configurazione mancante: META_PIXEL_ID o META_CAPI_TOKEN non impostati');
    return json(500, { error: 'missing_configuration' });
  }

  // accetta solo richieste dal proprio sito
  const origin = req.headers.get('origin') || '';
  let host = '';
  try { host = new URL(origin).hostname; } catch (e) {}
  if (!(host.endsWith('alvillaggiodeibambini.it') || host.endsWith('.netlify.app'))) {
    console.warn('Origine rifiutata:', origin || '(nessuna)');
    return json(403, { error: 'forbidden_origin' });
  }

  let body;
  try { body = await req.json(); } catch (e) { return json(400, { error: 'invalid_json' }); }

  const { event_name, event_id, event_source_url, fbp, fbc, user = {}, custom_data } = body || {};
  if (!ALLOWED_EVENTS.has(event_name) || !event_id) return json(400, { error: 'invalid_event' });

  const user_data = {
    client_ip_address: context.ip,
    client_user_agent: req.headers.get('user-agent') || undefined,
    fbp: fbp || undefined,
    fbc: fbc || undefined,
    em: hashed(normEmail(user.email)),
    ph: hashed(normPhone(user.phone)),
    fn: hashed(normName(user.first_name)),
    ln: hashed(normName(user.last_name)),
    country: hashed('it'),
  };
  Object.keys(user_data).forEach((k) => user_data[k] === undefined && delete user_data[k]);

  const payload = {
    data: [{
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: String(event_id),
      action_source: 'website',
      event_source_url: event_source_url || undefined,
      user_data,
      custom_data: custom_data && typeof custom_data === 'object' ? custom_data : undefined,
    }],
  };
  if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;

  const res = await fetch(
    `https://graph.facebook.com/${version}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_CAPI_TOKEN)}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }
  );
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Meta CAPI error', res.status, JSON.stringify(out));
    return json(502, { error: 'meta_error' });
  }
  console.log(`OK ${event_name} inviato a Meta – events_received: ${out.events_received}${META_TEST_EVENT_CODE ? ' (test)' : ''}`);
  return json(200, { ok: true, events_received: out.events_received });
};
