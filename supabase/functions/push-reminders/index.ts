// @ts-nocheck
// Road to 70.3 reminders. Woken every 15 minutes by pg_cron (and by test_push).
// Sends today's workout at each phone's morning time, and an evening nudge on training days with nothing logged.
import { sendPush } from './webpush.js';
import { buildPlan, normOv, eff, ds, dn, fmtDur, IDENT, DEFAULT_RACE, SPORT } from './plan.js';

const API = (Deno.env.get('SUPABASE_URL') || 'https://xsfptlfebxasxqgovktu.supabase.co') + '/rest/v1/rpc/';
const PUBLISHABLE_KEY = 'sb_publishable_I_yxeKhncGm2NvBGS6Z40A_h_Wh9m4i';

async function rpc(fn, args) {
  const r = await fetch(API + fn, { method: 'POST', headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' failed: ' + r.status + ' ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}

function localNow(tz, now) {
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  catch (e) { f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: p.year + '-' + p.month + '-' + p.day, min: (+p.hour % 24) * 60 + +p.minute };
}
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const fmt12 = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };

// Today's day for a member, with their moved days and switched workouts applied (same logic as the app).
function dayFor(member, n) {
  const race = /^\d{4}-\d{2}-\d{2}/.test(member.race_date || '') ? String(member.race_date).slice(0, 10) : DEFAULT_RACE;
  const plan = buildPlan(race);
  const wi = Math.floor((n - plan.start) / 7);
  if (wi < 0 || wi >= plan.N) return null;
  const w = plan.weeks[wi], ov = normOv((member.weeks || {})[ds(w.ws)]);
  const caps = {};
  w.days.forEach((d) => d.sessions.forEach((s) => { if (s.dur) caps[s.sport] = Math.max(caps[s.sport] || 0, s.dur); }));
  const o = w.days[(ov ? ov.order : IDENT)[n - w.ws]];
  // Workouts removed from the plan ('off' or 'off|<switch>') are left out; a day with all of them removed is a rest day.
  const kept = o.sessions.filter((s) => !(ov && /^off(\||$)/.test(ov.subs[s.id] || '')));
  const rest = o.rest || (!kept.length && !o.race ? 'Nothing planned today. Recover well.' : null);
  return { rest, race: !!o.race, sessions: kept.map((s) => eff(s, ov, caps)), week: wi + 1, phase: w.phase.name };
}

function morningMsg(name, day) {
  if (day.race) return { title: 'Race day!', body: 'Swim 1.2 · Bike 56 · Run 13.1. Go get it, ' + name + '.' };
  if (day.rest) return { title: 'Rest day', body: day.rest === 'Rest.' ? 'Nothing planned today. Recover well.' : day.rest };
  return {
    title: 'Today: ' + day.sessions.map((s) => s.title).join(' + '),
    body: day.sessions.map((s) => SPORT[s.sport] + (s.dur ? ' ' + fmtDur(s.dur) : '')).join(' · ') + ' · Week ' + day.week + ', ' + day.phase
  };
}
function eveningMsg(day) {
  const names = day.sessions.map((s) => s.title.toLowerCase());
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  return { title: 'Did you train today?', body: 'Log your ' + list + ', or tap Didn’t train.' };
}

Deno.serve(async (req) => {
  const secret = req.headers.get('x-r703-secret');
  if (!secret) return new Response('Forbidden', { status: 403 });
  let input = {};
  try { input = await req.json(); } catch (e) {}
  let due;
  try { due = await rpc('push_due', { p_secret: secret }); } catch (e) { return new Response('Forbidden', { status: 403 }); }

  const now = new Date();
  const vapid = { publicKey: due.vapid.publicKey, privateJwk: due.vapid.privateJwk, subject: due.vapid.subject };
  const marks = [], results = [];

  for (const sub of due.subs || []) {
    const member = (due.members || {})[sub.member];
    if (!member) continue;
    const send = async (msg, kind, ttl) => {
      try {
        const r = await sendPush(sub, { title: msg.title, body: msg.body, tag: 'r703-' + kind, url: './' }, vapid, ttl);
        results.push({ kind, status: r.status, host: new URL(sub.endpoint).host, detail: r.status >= 300 ? r.text : undefined });
        if (r.status === 404 || r.status === 410) marks.push({ endpoint: sub.endpoint, gone: true });
      } catch (e) {
        results.push({ kind, error: String(e).slice(0, 200), host: new URL(sub.endpoint).host });
      }
    };

    if (input.test) {
      if (sub.member === input.test) {
        await send({ title: 'Notifications are on', body: 'You’ll get today’s workout at ' + fmt12(sub.morning) + ', and a nudge at ' + fmt12(sub.evening) + ' if nothing’s logged.' }, 'test', 600);
      }
      continue;
    }

    const L = localNow(sub.tz, now), day = dayFor(member, dn(L.date));
    if (!day) continue;
    const mark = { endpoint: sub.endpoint };
    const m0 = toMin(sub.morning), e0 = toMin(sub.evening);
    if (L.min >= m0 && L.min < m0 + 120 && sub.last_morning !== L.date) {
      await send(morningMsg(member.name, day), 'morning', 4 * 3600);
      mark.morning = L.date;
    }
    if (L.min >= e0 && L.min < e0 + 180 && sub.last_evening !== L.date) {
      mark.evening = L.date;
      const logged = new Set(member.logged || []);
      if (day.sessions.length && !day.race && !day.sessions.some((s) => logged.has(s.id))) await send(eveningMsg(day), 'evening', 3 * 3600);
    }
    if (mark.morning || mark.evening) marks.push(mark);
  }

  if (marks.length) await rpc('push_mark', { p_secret: secret, p_items: marks });
  return Response.json({ ok: true, subs: (due.subs || []).length, results });
});
