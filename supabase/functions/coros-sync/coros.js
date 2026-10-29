// COROS: sign-in tokens, calls to the official COROS MCP connector, and matching watch workouts to the plan.
// Plain JavaScript so it runs in Deno (the edge function) and Node (the tests).
// @ts-nocheck
import { buildPlan, normOv, eff, ds, dn, wd, unitFor, IDENT, DEFAULT_RACE, PLAN_START } from './plan.js';

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
  // Workouts removed from the plan ('off' or 'off|<switch>') are left out.
  const kept = o.sessions.filter((s) => !(ov && /^off(\||$)/.test(ov.subs[s.id] || '')));
  return { rest: o.rest, race: !!o.race, sessions: kept.map((s) => eff(s, ov, caps)) };
}
function distFor(km, unit) {
  if (!km || !unit) return null;
  if (unit === 'mi') return Math.round(km * 0.621371 * 100) / 100;
  if (unit === 'yd') return Math.round(km * 1093.6133);
  return null;
}
const kindOf = (sp) => (sp === 'strength' ? 'strength' : 'endurance');
const weekOf = (date) => { const n = dn(date); return ds(n - wd(n)); };

// COROS always syncs in, and anything changed in the app wins.
// Each watch workout in the checked window (from..today) lands somewhere:
//   1. the planned workout of the same sport that day (after moved days, switched and removed workouts), or
//   2. an open planned workout of the same kind that day, switched to the watch's sport (open = not already
//      matched, nothing logged by hand, not switched by her, and not a switch she undid), or
//   3. an extra workout on that day (id YYYY-MM-DD_x<sport>), e.g. a run on a rest day.
// COROS writes a workout the first time it lands, then keeps it updated only while the entry still shows exactly
// what COROS wrote. Once someone edits or deletes it in the app, COROS leaves it alone.
// The window is worked out from scratch every time, including earlier automatic switches, so the result
// settles on the right answer as the day's workouts come in. Casual walks only count toward a planned hike.
// Returns:
//   fills      - sessions to set to Trained with COROS's time and distance
//   unfill     - sessions COROS no longer tracks
//   seen       - which COROS workout backs which session
//   gone       - COROS workouts that were deleted or no longer land anywhere
//   clears     - untouched COROS entries whose workout is gone, so their log is removed
//   weekWrites - week changes to save (her own changes plus the automatic switches)
//   auto       - automatic switches: { sessionId: { v: 'to:bike', day } }, and { no: true } for ones she undid
// If COROS returned no workouts at all, nothing changes.
const near = (a, b) => (a == null || b == null ? a == null && b == null : Math.abs(Number(a) - Number(b)) < 1e-6);
export function planSync(member, acts, tz, today, from) {
  const none = { fills: [], unfill: [], seen: [], gone: [], clears: [], weekWrites: [], auto: null };
  if (!acts.length) return none;
  const inWin = (d) => !!d && d >= from && d <= today;
  const current = {};
  for (const [ws, raw] of Object.entries(member.weeks || {})) { const ov = normOv(raw); if (ov) current[String(ws).slice(0, 10)] = ov; }
  // Earlier automatic switches. One she changed, undid or removed is hers now and is never switched again.
  const auto = {}, declined = {};
  for (const [sid, a] of Object.entries(member.auto || {})) {
    if (!a || typeof a.v !== 'string' || !a.day) continue;
    const cur = current[weekOf(sid.slice(0, 10))];
    if (a.no || !cur || cur.subs[sid] !== a.v) declined[sid] = { v: a.v, day: a.day, no: true };
    else auto[sid] = a;
  }
  // Her own week changes, without our automatic switches.
  const userWeeks = {};
  for (const [ws, ov] of Object.entries(current)) {
    const subs = { ...ov.subs };
    for (const [sid, a] of Object.entries(auto)) if (subs[sid] === a.v) delete subs[sid];
    userWeeks[ws] = { order: ov.order, subs };
  }
  const logs = member.logs || {}, filled = member.filled || {};
  // An entry COROS wrote that nobody has changed since.
  const untouched = (sid) => { const l = logs[sid], f = filled[sid]; return !!(l && f && l.s === 'done' && near(l.min, f.min) && near(l.dist, f.dist)); };
  // An entry COROS wrote that was then changed or deleted in the app.
  const overridden = (sid) => !!filled[sid] && !untouched(sid);
  // Automatic switches stay as they are on days before the window, and wherever someone has changed the entry.
  const keep = {};
  for (const [sid, a] of Object.entries(auto)) {
    if (inWin(a.day) && !overridden(sid) && !(logs[sid] && !untouched(sid))) continue;
    const cur = current[weekOf(sid.slice(0, 10))];
    if (cur && cur.subs[sid] === a.v) keep[sid] = a;
  }
  const baseWeeks = {};
  for (const [ws, w] of Object.entries(userWeeks)) baseWeeks[ws] = { order: w.order.slice(), subs: { ...w.subs } };
  for (const [sid, a] of Object.entries(keep)) {
    const ws = weekOf(sid.slice(0, 10));
    (baseWeeks[ws] = baseWeeks[ws] || { order: IDENT.slice(), subs: {} }).subs[sid] = a.v;
  }
  const base = { ...member, weeks: baseWeeks };

  const list = [];
  for (const a of acts) {
    const date = localDate(tz, a.start);
    if (date < PLAN_START || !inWin(date)) continue;
    const sp = sportOf(a.sportType);
    if (sp) list.push({ a, date, sp });
  }
  list.sort((x, y) => x.a.start - y.a.start);

  const days = new Map();
  const dayOf = (date) => { if (!days.has(date)) days.set(date, dayFor(base, dn(date))); return days.get(date); };
  const groups = new Map(), matched = new Map(), newAuto = {};
  const put = (id, unit, it) => {
    if (!groups.has(id)) groups.set(id, { unit, list: [] });
    groups.get(id).list.push(it.a);
    matched.set(it.a.id, { session: id, day: it.date });
  };
  // A COROS workout whose entry was changed in the app stays attached to that entry (and isn't filled again).
  const pinned = new Map();
  for (const r of member.seen || []) if (r.session && overridden(r.session)) pinned.set(r.label, r.session);
  // 1. Same sport as planned (not an entry someone has taken over).
  const left = [];
  for (const it of list) {
    const pin = pinned.get(it.a.id);
    if (pin) { put(pin, null, it); continue; }
    const day = dayOf(it.date), ss = (day && !day.race ? day.sessions : []).filter((x) => !overridden(x.id));
    const s = ss.find((x) => x.sport === it.sp) || (it.sp === 'walk' ? ss.find((x) => x.sport === 'hike') : null);
    if (s) put(s.id, unitFor(s), it); else left.push(it);
  }
  // 2 and 3. Switch an open planned workout to the watch's sport, or add an extra workout.
  const placed = new Map();
  for (const it of left) {
    if (it.sp === 'walk') continue;
    const day = dayOf(it.date);
    if (day && day.race) continue;
    const key = it.date + '|' + it.sp;
    let id = placed.get(key);
    if (!id) {
      const open = (day ? day.sessions : []).filter((x) => x.sport !== 'race' && !x.alt && !groups.has(x.id) && !declined[x.id] &&
        (!logs[x.id] || untouched(x.id)));
      // Only the same kind of workout (endurance for endurance, strength for strength): strength is often not on the watch,
      // so a ride shouldn't take over the strength slot she may still do later.
      const s = open.find((x) => kindOf(x.sport) === kindOf(it.sp));
      if (s) { id = s.id; newAuto[id] = { v: 'to:' + it.sp, day: it.date }; }
      else id = it.date + '_x' + it.sp;
      placed.set(key, id);
    }
    put(id, unitFor({ sport: it.sp, alt: newAuto[id] ? newAuto[id].v : undefined }), it);
  }

  const fills = [];
  for (const [id, g] of groups) {
    // Already written by COROS and changed or deleted in the app since: theirs now, leave it alone.
    if (overridden(id)) continue;
    // A walk only counts toward a hike when there's no real hike that day.
    const real = g.list.filter((a) => sportOf(a.sportType) !== 'walk'), use = real.length ? real : g.list;
    const secs = use.reduce((t, a) => t + (a.secs || 0), 0), km = use.reduce((t, a) => t + (a.km || 0), 0);
    fills.push({ session: id, min: secs ? Math.min(1440, Math.max(1, Math.round(secs / 60))) : null, dist: distFor(km, g.unit) });
  }
  const seen = [...matched].map(([label, v]) => ({ label, session: v.session, day: v.day }));
  const gone = [], clears = new Set(), unfill = new Set();
  for (const r of member.seen || []) {
    const d = r.day ? String(r.day).slice(0, 10) : null;
    if (!inWin(d)) continue;
    const now = matched.get(r.label);
    if (now && now.session === r.session) continue;
    if (!now) gone.push(r.label);
    if (r.session && !groups.has(r.session)) {
      if (untouched(r.session)) clears.add(r.session);   // only entries nobody changed come off
      if (filled[r.session]) unfill.add(r.session);
    }
  }
  // Week changes to save: her own changes plus the automatic switches.
  const autoOut = { ...declined, ...keep, ...newAuto }, touched = new Set();
  for (const sid of [...Object.keys(auto), ...Object.keys(newAuto)]) touched.add(weekOf(sid.slice(0, 10)));
  const weekWrites = [];
  for (const ws of touched) {
    const u = userWeeks[ws] || { order: IDENT.slice(), subs: {} }, subs = { ...u.subs };
    for (const [sid, a] of Object.entries(autoOut)) if (!a.no && weekOf(sid.slice(0, 10)) === ws) subs[sid] = a.v;
    const next = normOv({ order: u.order, subs });
    if (JSON.stringify(next) !== JSON.stringify(current[ws] || null)) weekWrites.push({ week: ws, data: next });
  }
  return { fills, unfill: [...unfill], seen, gone, clears: [...clears], weekWrites, auto: autoOut };
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
    if (from > today) { item.ok = true; return item; }
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
    item.fills = m.fills; item.unfill = m.unfill; item.seen = m.seen; item.gone = m.gone; item.clears = m.clears; item.weekWrites = m.weekWrites;
    if (m.auto) item.auto = m.auto;
    item.ok = true; item.count = acts.length;
  } catch (e) {
    item.error = e.reconnect ? 'COROS sign-in expired. Connect again.' : friendly(e);
    if (e.reconnect) item.reconnect = true;
  }
  return item;
}
