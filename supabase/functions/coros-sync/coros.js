// COROS: sign-in tokens, calls to the official COROS MCP connector, and matching watch workouts to the plan.
// Plain JavaScript so it runs in Deno (the edge function) and Node (the tests).
// @ts-nocheck
import { buildPlan, normOv, eff, ds, dn, unitFor, IDENT, DEFAULT_RACE, PLAN_START } from './plan.js';

export class CorosError extends Error {
  constructor(msg, opts = {}) { super(msg); this.status = opts.status || 0; this.reconnect = !!opts.reconnect; this.auth = !!opts.auth; }
}

/* ---------- Sign-in tokens (OAuth 2.0 with PKCE, public client) ---------- */
async function readJson(res) {
  const t = await res.text();
  try { return t ? JSON.parse(t) : {}; } catch (e) { return { raw: t.slice(0, 200) }; }
}
export async function tokenRequest(issuer, form, f = fetch) {
  const res = await f(issuer + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(form).toString()
  });
  const j = await readJson(res);
  if (!res.ok || !j.access_token) {
    const dead = j.error === 'invalid_grant' || j.error === 'invalid_client' || j.error === 'unauthorized_client';
    throw new CorosError('COROS ' + (form.grant_type === 'refresh_token' ? 'refresh' : 'sign-in') + ' failed (' + res.status + (j.error ? ' ' + j.error : '') + ')', { status: res.status, reconnect: dead });
  }
  return { access: j.access_token, refresh: j.refresh_token || null, expires_in: Number(j.expires_in) > 0 ? Math.round(Number(j.expires_in)) : 3600 };
}
export function exchangeCode(cfg, code, verifier, f) {
  return tokenRequest(cfg.issuer, { grant_type: 'authorization_code', client_id: cfg.client_id, code, redirect_uri: cfg.redirect, code_verifier: verifier, resource: cfg.issuer + '/mcp' }, f);
}
export function refreshTokens(cfg, refresh, f) {
  return tokenRequest(cfg.issuer, { grant_type: 'refresh_token', client_id: cfg.client_id, refresh_token: refresh, resource: cfg.issuer + '/mcp' }, f);
}

/* ---------- COROS MCP (JSON-RPC over streamable HTTP) ---------- */
function parseRpc(text, id) {
  const t = String(text || '').trim();
  if (t.startsWith('{')) { try { return JSON.parse(t); } catch (e) { return null; } }
  const msgs = t.split(/\r?\n\r?\n/).map((ev) => ev.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n')).filter(Boolean);
  for (const m of msgs) { try { const j = JSON.parse(m); if (j && j.id === id) return j; } catch (e) {} }
  return null;
}
export function toolText(result) {
  const parts = ((result && result.content) || []).filter((c) => c && c.type === 'text').map((c) => {
    let s = c.text || '';
    try { const j = JSON.parse(s); if (typeof j === 'string') s = j; } catch (e) {}
    return s;
  });
  if (!parts.length && result && result.structuredContent) return JSON.stringify(result.structuredContent);
  return parts.join('\n');
}
export async function mcpCall(issuer, token, name, args, f = fetch) {
  let sid = '', seq = 0;
  const send = async (method, params, notify) => {
    const id = ++seq;
    const res = await f(issuer + '/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'MCP-Protocol-Version': '2025-06-18', ...(sid ? { 'Mcp-Session-Id': sid } : {}) },
      body: JSON.stringify(notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id, method, params })
    });
    if (res.status === 401 || res.status === 403) { try { await res.text(); } catch (e) {} throw new CorosError('COROS sign-in expired', { status: res.status, auth: true }); }
    if (res.status === 429) throw new CorosError('COROS asked to slow down. It will try again soon.', { status: 429 });
    sid = (res.headers && res.headers.get && res.headers.get('mcp-session-id')) || sid;
    const text = await res.text();
    if (notify) return null;
    if (!res.ok) throw new CorosError('COROS request failed (' + res.status + ')', { status: res.status });
    const msg = parseRpc(text, id);
    if (!msg) throw new CorosError('COROS sent an answer the app couldn’t read');
    if (msg.error) throw new CorosError('COROS ' + method + ' error: ' + String(msg.error.message || '').slice(0, 120));
    return msg.result;
  };
  await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Road to 70.3', version: '1.0.0' } });
  await send('notifications/initialized', {}, true);
  const result = await send('tools/call', { name, arguments: args });
  if (result && result.isError) throw new CorosError(name + ' was refused: ' + toolText(result).slice(0, 150));
  return toolText(result);
}

/* ---------- Reading the workout list ---------- */
const toMs = (n) => (n < 1e12 ? n * 1000 : n);
function pick(s, re) { const m = re.exec(s); return m ? m[1] : null; }
export function durSecs(c) {
  let m = /\bDuration\s*[:=]\s*(\d+):(\d{2}):(\d{2})/i.exec(c);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = /\bDuration\s*[:=]\s*(\d+):(\d{2})(?![:\d])/i.exec(c);
  if (m) return +m[1] * 60 + +m[2];
  m = /\bDuration\s*[:=]\s*(?:(\d+)\s*h(?:ours?|rs?)?\s*)?(?:(\d+)\s*m(?:in(?:utes?|s)?)?\s*)?(?:(\d+)\s*s(?:ec(?:onds?|s)?)?)?/i.exec(c);
  if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  m = /\b(?:total[_ ]?time|duration)[_ ]?(?:sec(?:onds)?|\(s\))\s*[:=]\s*(\d+)/i.exec(c);
  return m ? +m[1] : null;
}
export function distKm(c) {
  const m = /\bDistance\s*[:=]\s*([\d.,]+)\s*(km|kilometers?|kilometres?|mi|miles?|m|meters?|metres?|yd|yds|yards?)\b/i.exec(c);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, '')), u = m[2].toLowerCase();
  if (!isFinite(v) || v <= 0) return null;
  if (u.startsWith('k')) return v;
  if (u === 'mi' || u.startsWith('mile')) return v * 1.609344;
  if (u.startsWith('y')) return v * 0.0009144;
  return v / 1000;
}
function findList(j) {
  if (Array.isArray(j)) return j;
  if (j && typeof j === 'object') for (const k of ['records', 'sportRecords', 'activities', 'list', 'data', 'items']) { const v = j[k]; if (Array.isArray(v)) return v; if (v && typeof v === 'object') { const w = findList(v); if (w) return w; } }
  return null;
}
function fromObj(o) {
  if (!o || typeof o !== 'object') return null;
  const id = o.labelId || o.label_id || o.id, ts = Number(o.startTimestamp || o.startTime || o.start_time), sp = Number(o.sportType ?? o.sport_type ?? o.mode);
  if (!id || !ts || !isFinite(sp)) return null;
  const secs = Number(o.totalTime ?? o.duration ?? o.workoutTime) || null, dist = Number(o.distance) || null;
  return { id: String(id), start: toMs(ts), sportType: sp, secs, km: dist ? dist / 1000 : null };
}
// The COROS tool answers in text: a numbered list with labelId, startTimestamp, sportType, Duration and Distance per workout.
export function parseRecords(text) {
  const t = String(text || '').trim();
  if (!t || /^\s*no\b[\s\S]{0,80}\bfound\b/i.test(t)) return [];
  if (/^[\[{]/.test(t)) {
    try { const list = findList(JSON.parse(t)); if (list) { const out = list.map(fromObj).filter(Boolean); if (out.length || !list.length) return out; } } catch (e) {}
  }
  const out = [], ids = new Set();
  for (const c of t.split(/\n(?=\s*(?:#{1,4}\s*)?\d+[.)]\s)/)) {
    const id = pick(c, /\blabel[_ ]?id\s*[:=]\s*["']?([A-Za-z0-9_-]+)/i);
    const ts = pick(c, /\bstart[_ ]?(?:timestamp|time)\s*[:=]\s*(\d{9,13})\b/i);
    const sp = pick(c, /\bsport[_ ]?type\s*[:=]\s*(\d+)/i);
    if (!id || !ts || !sp || ids.has(id)) continue;
    ids.add(id);
    out.push({ id, start: toMs(+ts), sportType: +sp, secs: durSecs(c), km: distKm(c) });
  }
  if (!out.length) throw new CorosError('COROS changed how it lists workouts, so nothing was filled in.');
  return out;
}

/* ---------- Matching workouts to the plan ---------- */
export function sportOf(code) {
  code = Number(code);
  if (code === 104 || code === 105) return 'hike';
  if (code === 900) return 'walk';
  if (code >= 100 && code < 200) return 'run';
  if (code >= 200 && code < 300) return 'bike';
  if (code >= 300 && code < 400) return 'swim';
  if (code === 402) return 'strength';
  return null;
}
export function localDate(tz, ms) {
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch (e) { f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }); }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return p.year + '-' + p.month + '-' + p.day;
}
// A person's day with their moved days and switched workouts applied (same logic as the app).
export function dayFor(member, n) {
  const race = /^\d{4}-\d{2}-\d{2}/.test(member.race_date || '') ? String(member.race_date).slice(0, 10) : DEFAULT_RACE;
  const plan = buildPlan(race);
  const wi = Math.floor((n - plan.start) / 7);
  if (wi < 0 || wi >= plan.N) return null;
  const w = plan.weeks[wi], ov = normOv((member.weeks || {})[ds(w.ws)]);
  const caps = {};
  w.days.forEach((d) => d.sessions.forEach((s) => { if (s.dur) caps[s.sport] = Math.max(caps[s.sport] || 0, s.dur); }));
  const o = w.days[(ov ? ov.order : IDENT)[n - w.ws]];
  return { rest: o.rest, race: !!o.race, sessions: o.sessions.map((s) => eff(s, ov, caps)) };
}
function distFor(km, unit) {
  if (!km || !unit) return null;
  if (unit === 'mi') return Math.round(km * 0.621371 * 100) / 100;
  if (unit === 'yd') return Math.round(km * 1093.6133);
  return null;
}
// COROS is the source of truth for every planned workout it has a match for.
// A workout matches the planned session of the same sport on the same day (after moved days and switched workouts).
// Returns:
//   fills  - sessions to set to Trained with COROS's time and distance (overwrites what's logged)
//   seen   - which COROS workout backs which session
//   gone   - COROS workouts that were deleted or no longer match anything
//   clears - sessions that were backed by COROS and no longer are, so their log is removed
// Workouts outside the checked window are left alone, and nothing is cleared if COROS returned no workouts at all.
export function planSync(member, acts, tz, today, from) {
  const groups = new Map(), matched = new Map();
  for (const a of acts) {
    const date = localDate(tz, a.start);
    if (date < PLAN_START || date > today) continue;
    const sp = sportOf(a.sportType);
    if (!sp) continue;
    const day = dayFor(member, dn(date));
    if (!day || !day.sessions.length) continue;
    const s = day.sessions.find((x) => x.sport === sp) || (sp === 'walk' ? day.sessions.find((x) => x.sport === 'hike') : null);
    if (!s || s.sport === 'race') continue;
    if (!groups.has(s.id)) groups.set(s.id, { s, list: [] });
    groups.get(s.id).list.push(a);
    matched.set(a.id, { session: s.id, day: date });
  }
  const fills = [];
  for (const { s, list } of groups.values()) {
    // A walk only counts toward a hike when there's no real hike that day.
    const real = list.filter((a) => sportOf(a.sportType) !== 'walk'), use = real.length ? real : list;
    const secs = use.reduce((t, a) => t + (a.secs || 0), 0), km = use.reduce((t, a) => t + (a.km || 0), 0);
    fills.push({ session: s.id, min: secs ? Math.min(1440, Math.max(1, Math.round(secs / 60))) : null, dist: distFor(km, unitFor(s)) });
  }
  const seen = [...matched].map(([label, v]) => ({ label, session: v.session, day: v.day }));
  const gone = [], clears = new Set();
  if (acts.length) {
    for (const r of member.seen || []) {
      const d = r.day ? String(r.day).slice(0, 10) : null;
      if (!d || d < from || d > today) continue;
      const now = matched.get(r.label);
      if (now && now.session === r.session) continue;
      if (!now) gone.push(r.label);
      if (r.session && !groups.has(r.session)) clears.add(r.session);
    }
  }
  return { fills, seen, gone, clears: [...clears] };
}

/* ---------- One person's sync ---------- */
function friendly(e) {
  if (e instanceof CorosError) return e.message;
  return 'Couldn’t reach COROS. It will try again soon.';
}
export async function syncLink(cfg, link, member, now, f = fetch) {
  const item = { member: link.member, ok: false };
  try {
    let access = link.access;
    const exp = link.expires_at ? Date.parse(link.expires_at) : 0;
    if (!access || exp - now.getTime() < 120000) { item.tokens = await refreshTokens(cfg, link.refresh, f); access = item.tokens.access; }
    const today = localDate(link.tz, now.getTime());
    let from = ds(dn(today) - (link.first ? 29 : 6));
    if (from < PLAN_START) from = PLAN_START;
    if (from > today) { item.ok = true; item.fills = []; item.seen = []; item.gone = []; item.clears = []; return item; }
    const args = { startDate: from.replace(/-/g, ''), endDate: today.replace(/-/g, ''), sportTypeCodes: [65535], minDistanceKm: 0, maxDistanceKm: 0, minDurationMinutes: 0, maxDurationMinutes: 0, maxAveragePace: '', locationKeyword: '', limit: 200 };
    let text;
    try { text = await mcpCall(cfg.issuer, access, 'querySportRecords', args, f); }
    catch (e) {
      if (!e.auth || item.tokens) throw e;
      item.tokens = await refreshTokens(cfg, link.refresh, f);
      try { text = await mcpCall(cfg.issuer, item.tokens.access, 'querySportRecords', args, f); }
      catch (e2) { if (e2.auth) e2.reconnect = true; throw e2; }
    }
    item.raw = String(text).slice(0, 4000);
    const acts = parseRecords(text);
    const m = planSync(member, acts, link.tz, today, from);
    item.fills = m.fills; item.seen = m.seen; item.gone = m.gone; item.clears = m.clears; item.ok = true; item.count = acts.length;
  } catch (e) {
    item.error = e.reconnect ? 'COROS sign-in expired. Connect again.' : friendly(e);
    if (e.reconnect) item.reconnect = true;
  }
  return item;
}
