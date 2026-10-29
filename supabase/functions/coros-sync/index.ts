// @ts-nocheck
// Road to 70.3 COROS sync.
//  GET  .../coros-sync/callback  COROS sends the person back here after they sign in. Hands the code to the database.
//  POST {finish: state}          From the database (with the shared secret): trade the code for tokens, then sync.
//  POST {sync: member} or {}     From the timer or "Check now" (with the shared secret): sync recent workouts.
//                                COROS is the source of truth for every planned workout it has a match for.
import { exchangeCode, syncLink, CorosError } from './coros.js';

const API = (Deno.env.get('SUPABASE_URL') || 'https://xsfptlfebxasxqgovktu.supabase.co') + '/rest/v1/rpc/';
const PUBLISHABLE_KEY = 'sb_publishable_I_yxeKhncGm2NvBGS6Z40A_h_Wh9m4i';
const APP = 'https://63csmith.github.io/road-to-703/';

async function rpc(fn, args) {
  const r = await fetch(API + fn, { method: 'POST', headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' failed: ' + r.status + ' ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}
const backToApp = (result) => new Response(null, { status: 302, headers: { Location: APP + '?coros=' + result + '#team', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET' && url.pathname.endsWith('/callback')) {
    const state = url.searchParams.get('state'), code = url.searchParams.get('code'), err = url.searchParams.get('error');
    let ok = false;
    try { ok = await rpc('coros_got_code', { p_state: state, p_auth_code: code, p_error: err }); } catch (e) {}
    return backToApp(!ok ? 'expired' : err ? (err === 'access_denied' ? 'cancel' : 'error') : 'ok');
  }
  if (req.method !== 'POST') return new Response('Not found', { status: 404 });

  const secret = req.headers.get('x-r703-secret');
  if (!secret) return new Response('Forbidden', { status: 403 });
  let input = {};
  try { input = await req.json(); } catch (e) {}

  if (input.finish) {
    let fin;
    try { fin = await rpc('coros_finish', { p_secret: secret, p_state: String(input.finish) }); } catch (e) { return new Response('Forbidden', { status: 403 }); }
    if (!fin) return Response.json({ ok: false, why: 'no pending sign-in' });
    try {
      const t = await exchangeCode(fin, fin.code, fin.verifier);
      if (!t.refresh) throw new CorosError('COROS didn’t allow ongoing access. Try connecting again.');
      await rpc('coros_link_save', { p_secret: secret, p_member: fin.member, p_access: t.access, p_refresh: t.refresh, p_expires_in: t.expires_in, p_tz: fin.tz });
    } catch (e) {
      await rpc('coros_finish_failed', { p_secret: secret, p_member: fin.member, p_error: 'COROS sign-in didn’t finish. Try again.' }).catch(() => {});
      return Response.json({ ok: false, error: String((e && e.message) || e).slice(0, 300) });
    }
    input = { sync: fin.member };
  }

  let due;
  try { due = await rpc('coros_due', { p_secret: secret, p_member: input.sync || null }); } catch (e) { return new Response('Forbidden', { status: 403 }); }
  const cfg = { issuer: due.issuer, client_id: due.client_id };
  const now = new Date(), items = [];
  for (const link of due.links || []) {
    const member = (due.members || {})[link.member];
    if (member) items.push(await syncLink(cfg, link, member, now));
  }
  // Automatic workout switches, then workouts deleted in COROS (or that no longer land anywhere) come off the plan.
  // Done before saving the rest, so a failure is retried on the next check.
  for (const it of items) {
    const code = ((due.members || {})[it.member] || {}).team_code;
    if (!code) continue;
    for (const w of it.weekWrites || []) {
      await rpc('set_week', { p_code: code, p_member: it.member, p_week: w.week, p_data: w.data }).catch(() => {});
    }
    for (const session of it.clears || []) {
      await rpc('set_log', { p_code: code, p_member: it.member, p_session: session, p_status: null }).catch(() => {});
    }
  }
  if (items.length) await rpc('coros_apply', { p_secret: secret, p_items: items.map(({ weekWrites, clears, ...rest }) => rest) });
  return Response.json({ ok: true, results: items.map((i) => ({ ok: i.ok, workouts: i.count, filled: (i.fills || []).length, switched: (i.weekWrites || []).length, cleared: (i.clears || []).length, error: i.error })) });
});
