// Generated from index.html (the Plan section) so reminders match the app exactly.
// Regenerate this file whenever the plan in index.html changes.
// @ts-nocheck
/* ---------- Plan ---------- */
var PLAN_START = '2026-10-26';
var DEFAULT_RACE = '2027-06-12';
var DAYMS = 86400000;
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
var DOW_LONG = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
var SPORT = { swim: 'Swim', bike: 'Bike', run: 'Run', strength: 'Strength', hike: 'Hike', race: 'Race' };

function dn(s) { var a = s.split('-').map(Number); return Math.round(Date.UTC(a[0], a[1] - 1, a[2]) / DAYMS); }
function ds(n) { return new Date(n * DAYMS).toISOString().slice(0, 10); }
function wd(n) { return ((n + 3) % 7 + 7) % 7; }
function fmtShort(n) { var t = new Date(n * DAYMS); return MONTHS[t.getUTCMonth()] + ' ' + t.getUTCDate(); }
function fmtLong(n) { var t = new Date(n * DAYMS); return DOW[wd(n)] + ', ' + MONTHS[t.getUTCMonth()] + ' ' + t.getUTCDate() + ', ' + t.getUTCFullYear(); }
function fmtDur(m) { m = Math.round(m); if (m < 60) return m + ' min'; var h = Math.floor(m / 60), r = m % 60; return h + 'h' + (r ? ' ' + String(r).padStart(2, '0') + 'm' : ''); }
function fmtHours(m) { return (Math.round(m / 6) / 10).toFixed(1) + ' h'; }
function round5(v) { return Math.max(5, Math.round(v / 5) * 5); }
function fmtNum(v) { return v >= 1000 ? v.toLocaleString('en-US') : String(v); }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function interp(t, p) {
  return t.replace(/\{(\d+)-(\d+)\}/g, function (m, a, b) {
    a = +a; b = +b;
    if (p <= 0) return fmtNum(a);
    if (p >= 1) return fmtNum(b);
    var v = a + (b - a) * p;
    v = (a >= 100 && b >= 100) ? Math.round(v / 50) * 50 : Math.round(v);
    return fmtNum(v);
  });
}
function S(sport, title, a, b, text) { return { sport: sport, title: title, a: a, b: b, text: text }; }

var STR_A = '{2-3} rounds: 15 kettlebell swings, 10 goblet squats, 8 single-arm rows per side, 8 reverse lunges per side, 30 s plank. Rest 60–90 s between rounds.';
var STR_B = '{2-3} rounds: 10 kettlebell deadlifts, 10 push-ups, 8 single-leg RDLs per side, 12 calf raises per side, 10 dead bugs per side.';
var STR_M = '2 rounds: 15 kettlebell swings, 10 goblet squats, 8 single-leg RDLs per side, 45 s plank.';

var PHASES = [
  { key: 'foundation', name: 'Foundation', from: Infinity, to: 23,
    blurb: 'Build the habit and the aerobic engine. Everything is easy (Z1–Z2) apart from short strides and cadence drills. Walk breaks on runs are smart while your legs adapt.',
    days: [
      'Rest. An easy 20–30 min walk is fine.',
      [S('swim', 'Technique swim', 30, 45, 'Warm-up 200 yd easy. Drills: 6 × 50 yd (catch-up, fingertip drag, 6-kick side switch), 20 s rest. Main: {4-8} × 100 yd easy, 20 s rest. Cool-down 100 yd.'),
       S('strength', 'Kettlebell strength', 20, 30, STR_A)],
      [S('bike', 'Endurance ride', 40, 60, 'Trainer is fine. Steady Z2. Last 10 min: 5 × 1 min at high cadence (95–105 rpm), 1 min easy.')],
      [S('run', 'Easy run', 25, 40, 'Z2, conversational. Walk for a minute whenever heart rate drifts above Z2. Finish with {4-6} × 20 s relaxed strides.'),
       S('strength', 'Kettlebell strength', 20, 30, STR_B)],
      'Rest.',
      [S('bike', 'Long ride', 60, 105, 'Steady Z2. Drink every 15 min. Indoors, break it into 20-min blocks with a 1-min easy spin between.')],
      [S('run', 'Long run', 35, 60, 'Easy Z2 the whole way. Run 9 min, walk 1 min if you need it.')]
    ] },
  { key: 'base', name: 'Base', from: 22, to: 17,
    blurb: 'More volume, a second swim, and your first tempo work. Most of the time is still Z2.',
    days: [
      'Rest.',
      [S('swim', 'Endurance swim', 45, 55, 'Warm-up 300 yd. Drills 4 × 50 yd. Main: {5-8} × 200 yd steady (Z2–Z3), 20 s rest. Cool-down 200 yd.'),
       S('strength', 'Kettlebell strength', 30, 30, '3 rounds: 15 swings, 10 goblet squats, 8 rows per side, 8 step-ups per side, 10 dead bugs per side.')],
      [S('bike', 'Tempo ride', 60, 75, 'Warm-up 15 min. Main: {3-4} × 8 min at Z3, 4 min easy between. Spin easy to finish.')],
      [S('run', 'Aerobic run', 40, 50, 'Z2. Last 10 min: {4-6} × 20 s strides with a full walk-back recovery.'),
       S('strength', 'Kettlebell strength', 25, 25, '3 rounds: 10 deadlifts, 10 push-ups, 8 single-leg RDLs per side, 15 calf raises per side, 30 s side plank per side.')],
      [S('swim', 'Aerobic swim', 30, 40, 'Swim {800-1400} yd continuous at easy effort. Breathe every 3 strokes and sight forward every 6–8 strokes.')],
      [S('bike', 'Long ride', 105, 150, 'Z2, with the last 20 min at Z3. Start practicing fuel: 40–60 g carbs per hour.')],
      [S('run', 'Long run', 60, 80, 'Easy Z2. Take a 1-min walk every 10 min if needed.')]
    ] },
  { key: 'build', name: 'Build', from: 16, to: 11,
    blurb: 'Race-specific intensity arrives: threshold intervals, your first bricks, and race fueling. Strength drops to once a week.',
    days: [
      'Rest.',
      [S('swim', 'Threshold swim', 55, 60, 'Warm-up 400 yd. Main: {6-10} × 200 yd at race effort, 15 s rest. Pull 300 yd. Cool-down 200 yd.')],
      [S('bike', 'Threshold ride', 75, 90, 'Warm-up 15 min. Main: {3-4} × 10 min at Z4, 5 min easy between. Cool-down 10 min.')],
      [S('run', 'Interval run', 50, 60, 'Warm-up 15 min easy. Main: {3-5} × 5 min at Z4, 2 min jog between. Cool-down 10 min.'),
       S('strength', 'Strength maintenance', 20, 20, STR_M)],
      [S('swim', 'Sighting swim', 40, 45, 'Warm-up 300 yd. Main: 10 × 100 yd sighting every 6 strokes, 15 s rest, then {300-600} yd continuous. Cool-down 100 yd.')],
      [S('bike', 'Long ride', 150, 180, 'Z2 with {2-3} × 15 min at race effort (Z3). Fuel like race day: 60–80 g carbs per hour.'),
       S('run', 'Brick run', 15, 25, 'Straight off the bike. First 5 min easy to find your legs, then steady Z2.')],
      [S('run', 'Long run', 75, 90, 'Easy Z2. Take a gel at 45 min to practice.')]
    ] },
  { key: 'specific', name: 'Race-specific', from: 10, to: 7,
    blurb: 'Longer blocks at race effort. You will swim the full 1.2 mi and ride past three hours.',
    days: [
      'Rest.',
      [S('swim', 'Race-pace swim', 60, 60, 'Warm-up 400 yd. Main: {3-4} × 500 yd at race effort, 30 s rest. Cool-down 200 yd.')],
      [S('bike', 'Race-effort ride', 75, 90, 'Warm-up 15 min. Main: {2-3} × 15 min at race effort (Z3 to low Z4), 5 min easy between. Spin easy to finish.'),
       S('run', 'Brick run', 15, 15, 'Straight off the bike: 15 min at race effort.')],
      [S('run', 'Threshold run', 55, 60, 'Warm-up 15 min. Main: {2-3} × 10 min at Z4, 3 min jog between. Cool-down 10 min.'),
       S('strength', 'Strength maintenance', 20, 20, STR_M)],
      [S('swim', 'Distance swim', 45, 50, 'Swim {1800-2112} yd continuous at steady effort, sighting as you go. 2,112 yd is your race distance.')],
      [S('bike', 'Long ride', 180, 210, 'Z2 with the middle {45-60} min at race effort. Full race fueling.'),
       S('run', 'Brick run', 25, 35, 'Straight off the bike: first 10 min at race effort, then easy Z2.')],
      [S('run', 'Long run', 85, 100, 'Easy Z2, with the last {10-15} min at race effort.')]
    ] },
  { key: 'peak', name: 'Peak', from: 6, to: 3,
    blurb: 'Your biggest weeks, with race simulations on Saturdays. Sleep and food matter as much as the workouts now.',
    days: [
      'Rest.',
      [S('swim', 'Race-pace swim', 60, 70, 'Warm-up 400 yd. Main: {4-5} × 400 yd at race pace, 20 s rest. Cool-down 200 yd.')],
      [S('bike', 'Race-effort ride', 90, 105, 'Warm-up 15 min. Main: 2 × {25-30} min at race effort, 5 min easy between. Spin easy to finish.'),
       S('run', 'Brick run', 20, 20, 'Straight off the bike at race effort.')],
      [S('run', 'Race-pace run', 60, 70, 'Warm-up 15 min. Main: {25-35} min at half-marathon race effort. Cool-down 10–15 min.')],
      [S('swim', 'Distance swim', 45, 50, '{2000-2400} yd as 500s at steady effort with sighting, 30 s rest between.')],
      [S('bike', 'Race simulation ride', 195, 225, 'Ride the middle 2 hours at race effort with full race fueling and the gear you will race in.'),
       S('run', 'Brick run', 35, 45, 'Straight off the bike: 20 min at race effort, then settle into Z2.')],
      [S('run', 'Long run', 95, 115, 'Easy Z2. Fuel exactly as you will on race day.')]
    ] },
  { key: 'taper', name: 'Taper', from: 2, to: 1,
    blurb: 'Volume drops while a little intensity stays. Expect to feel fresh and a bit restless. That is the point.',
    days: [
      'Rest.',
      [S('swim', 'Sharpening swim', 50, 40, 'Warm-up 300 yd. Main: {6-4} × 200 yd at race pace, 20 s rest. Cool-down 200 yd.')],
      [S('bike', 'Sharpening ride', 75, 60, 'Warm-up 15 min. Main: 3 × {10-5} min at race effort, 3 min easy between. Spin easy to finish.'),
       S('run', 'Brick run', 15, 10, 'Easy off the bike, with 2 min at race pace.')],
      [S('run', 'Sharpening run', 45, 35, 'Warm-up 10 min. Main: 3 × {6-3} min at race effort, 2 min jog between. Cool-down 10 min.')],
      [S('swim', 'Easy swim', 35, 30, 'Easy continuous swim. Practice sighting and a fast first 100 yd like a race start.')],
      [S('bike', 'Dress rehearsal ride', 150, 90, 'Z2 with {30-15} min at race effort. Use exactly the gear and nutrition you will race with.'),
       S('run', 'Brick run', 20, 15, 'Easy off the bike.')],
      [S('run', 'Long run', 70, 45, 'Easy Z2.')]
    ] },
  { key: 'race', name: 'Race week', from: 0, to: 0,
    blurb: 'Short, sharp openers and plenty of rest. Nothing new on race day: same food, same gear.',
    days: null }
];

var RACE_WEEK = {
  6: 'Rest.',
  5: [S('swim', 'Openers swim', 30, 30, 'Easy, with 4 × 100 yd at race pace.')],
  4: [S('bike', 'Openers ride', 45, 45, 'Easy, with 3 × 3 min at race effort.')],
  3: [S('run', 'Openers run', 25, 25, 'Easy, with 4 × 30 s at race pace.')],
  2: 'Rest. Pack your transition bags and check over the bike.',
  1: [S('swim', 'Shakeout swim', 15, 15, 'Easy. Swim part of the course if it is open.'),
      S('bike', 'Shakeout ride', 20, 20, 'Easy spin with two 1-min pickups. Check gears, brakes and tires.'),
      S('run', 'Shakeout run', 10, 10, 'Easy jog with three short pickups.')]
};
var RACE_SESSION = { sport: 'race', title: 'Race day', a: 0, b: 0, text: 'Swim 1.2 mi, bike 56 mi, run 13.1 mi. Start the swim steady, fuel early on the bike, and race the second half of the run.' };
var EASY = {
  swim: 'Recovery week: easy swim with drills, no hard sets.',
  bike: 'Recovery week: easy Z1–Z2 spin, no intervals.',
  run: 'Recovery week: easy Z2, no intervals. Walk breaks are fine.',
  strength: 'Recovery week: 2 light rounds of your usual circuit.'
};
var RECOVERY_NOTE = 'Recovery week. Everything is about 30% shorter and easy, so the work from the last few weeks can sink in.';

var IDENT = [0, 1, 2, 3, 4, 5, 6];
var ALT_PROMPT = { swim: 'No pool?', bike: 'No bike?', strength: 'No kettlebell?' };
var ALTS = {
  swim: [
    { key: 'dryland', label: 'Bands + core', title: function () { return 'Dryland swim session'; }, dur: function (m) { return Math.min(m, 40); },
      text: 'No pool. Anchor a resistance band at chest height, or use a gym cable machine. Warm up with 5 min of arm circles and band pull-aparts. Then 4 rounds: 60 s bent-over freestyle pulls (high elbow, finish past the hip), 15 straight-arm pulldowns, 10 push-ups, 30 s plank. Finish with 5 min of shoulder mobility.' },
    { key: 'row', label: 'Rower', title: function () { return 'Row instead'; },
      text: 'Hotel-gym rower for the same time at Z2. It works the same pulling muscles. No rower? Use the bike or elliptical.' }
  ],
  bike: [
    { key: 'gym', label: 'Gym bike', title: function (t) { return t + ' (gym bike)'; },
      text: function (t) { return t + ' Ride it on a hotel-gym or spin bike: match the time and heart-rate zones, not the watts. No bike at all? Use the elliptical at the same effort.'; } }
  ],
  strength: [
    { key: 'bw', label: 'Bodyweight', title: function () { return 'Bodyweight strength'; },
      text: '3 rounds: 20 squats, 10 reverse lunges per side, 10 push-ups, 10 single-leg RDLs per side (hold a loaded backpack if you have one), 15 glute bridges, 30 s plank.' }
  ]
};
var SWAP_TO = ['swim', 'bike', 'run', 'strength', 'hike'];
var SWAP_CAP = { swim: 75, run: 120, strength: 45, hike: 240 };
var SWAP_TITLE = {
  swim: { easy: 'Easy swim', steady: 'Race-effort swim', hard: 'Threshold swim' },
  bike: { easy: 'Easy ride', steady: 'Race-effort ride', hard: 'Threshold ride' },
  run: { easy: 'Easy run', steady: 'Race-effort run', hard: 'Threshold run' },
  strength: { easy: 'Kettlebell strength', steady: 'Kettlebell strength', hard: 'Kettlebell strength' },
  hike: { easy: 'Easy hike', steady: 'Hilly hike', hard: 'Steep hike' }
};
var STR_SWAP = '3 rounds: 15 kettlebell swings, 10 goblet squats, 8 single-arm rows per side, 8 reverse lunges per side, 30 s plank.';
var SWAP_TEXT = {
  swim: {
    easy: 'Easy continuous swim with a few lengths of drills. Breathe every 3 strokes and sight forward now and then.',
    steady: 'Warm-up 300 yd. Main: 200s at race effort with 20 s rest, for most of the session. Cool-down 200 yd.',
    hard: 'Warm-up 400 yd. Main: 100s at threshold effort with 15 s rest, for most of the session. Cool-down 200 yd.'
  },
  bike: {
    easy: 'Easy Z2 ride, or a trainer or gym-bike spin. Keep cadence around 85–95 rpm.',
    steady: 'Warm-up 15 min. Ride the middle of the session at race effort (Z3), then spin easy to finish.',
    hard: 'Warm-up 15 min. Main: 3–4 × 10 min at Z4, 5 min easy between. Cool-down 10 min.'
  },
  run: {
    easy: 'Easy Z2 run, conversational. Walk breaks are fine.',
    steady: 'Warm-up 10 min easy. Run the middle of the session at race effort (Z3), then cool down 5–10 min.',
    hard: 'Warm-up 15 min easy. Main: 4–5 × 5 min at Z4, 2 min jog between. Cool-down 10 min.'
  },
  strength: { easy: STR_SWAP, steady: STR_SWAP, hard: STR_SWAP },
  hike: {
    easy: 'Easy hike at a conversational pace (Z1–Z2). Longer is fine. Carry water, a layer, and fuel for anything over 90 minutes.',
    steady: 'Pick a route with long climbs and hike the uphills at a steady, breathing-hard-but-can-talk effort (Z2–Z3). Take the descents easy.',
    hard: 'Find a steep trail or hill. Hike the climbs hard (Z3–Z4) and recover on the way down. Treat each climb as an interval.'
  }
};
function effortOf(s) {
  var t = s.text || '';
  if (/Z4|threshold/i.test(t)) return 'hard';
  if (/race effort|race pace|race-pace|Z3|tempo/i.test(t)) return 'steady';
  return 'easy';
}
function findAlt(sport, key) { var list = ALTS[sport] || []; for (var i = 0; i < list.length; i++) { if (list[i].key === key) return list[i]; } return null; }
function eff(s, ov, caps) {
  var key = ov && ov.subs[s.id];
  if (!key || s.sport === 'race') return s;
  if (key.indexOf('to:') === 0) {
    var to = key.slice(3);
    if (SWAP_TO.indexOf(to) < 0 || to === s.sport) return s;
    var e = effortOf(s), cap = Math.min(SWAP_CAP[to] || Infinity, (caps && caps[to]) || Infinity);
    return { id: s.id, sport: to, alt: key, orig: s.sport, title: SWAP_TITLE[to][e], dur: round5(Math.min(s.dur, cap)),
      text: 'In place of the planned ' + s.title.toLowerCase() + ' (' + fmtDur(s.dur) + '). ' + SWAP_TEXT[to][e] };
  }
  var alt = findAlt(s.sport, key);
  if (!alt) return s;
  return { id: s.id, sport: s.sport, alt: key, title: alt.title(s.title),
    dur: alt.dur ? round5(alt.dur(s.dur)) : s.dur,
    text: typeof alt.text === 'function' ? alt.text(s.text) : alt.text };
}
function normOv(o) {
  if (!o || typeof o !== 'object') return null;
  var order = (Array.isArray(o.order) && o.order.length === 7 && o.order.slice().sort().join() === '0,1,2,3,4,5,6') ? o.order.slice() : IDENT.slice();
  var subs = {};
  if (o.subs && typeof o.subs === 'object') Object.keys(o.subs).sort().forEach(function (k) { if (typeof o.subs[k] === 'string' && o.subs[k]) subs[k] = o.subs[k]; });
  var ident = order.every(function (v, i) { return v === i; });
  if (ident && !Object.keys(subs).length) return null;
  return { order: order, subs: subs };
}
var UNIT = { swim: 'yd', bike: 'mi', run: 'mi', hike: 'mi' };
function unitFor(s) { if (s.sport === 'swim' && s.alt && s.alt.indexOf('to:') !== 0) return null; return UNIT[s.sport] || null; }

function phaseFor(wo) { for (var i = 0; i < PHASES.length; i++) { if (wo <= PHASES[i].from && wo >= PHASES[i].to) return PHASES[i]; } return PHASES[0]; }

function buildPlan(raceStr) {
  var start = dn(PLAN_START), race = dn(raceStr);
  var rws = race - wd(race);
  var N = Math.round((rws - start) / 7) + 1;
  var weeks = [];
  for (var i = 0; i < N; i++) {
    var ws = start + 7 * i, wo = N - 1 - i;
    var ph = phaseFor(wo);
    var from = ph.from === Infinity ? N - 1 : ph.from;
    var p = from <= ph.to ? 1 : Math.min(1, Math.max(0, (from - wo) / (from - ph.to)));
    var recovery = wo >= 7 && (wo - 7) % 4 === 0 && i >= 3;
    var days = [], minutes = 0, count = 0;
    for (var d = 0; d < 7; d++) {
      var n = ws + d, tpl, isRace = false;
      if (ph.key === 'race') {
        var off = race - n;
        if (off < 0) tpl = 'Recovery. Walk, eat well, and sleep. You earned it.';
        else if (off === 0) { tpl = [RACE_SESSION]; isRace = true; }
        else tpl = RACE_WEEK[off] || 'Rest.';
      } else tpl = ph.days[d];
      if (typeof tpl === 'string') { days.push({ n: n, rest: tpl, sessions: [] }); continue; }
      var sessions = tpl.map(function (s) {
        var dur = null, text = s.text;
        if (s.sport !== 'race') {
          dur = round5(s.a + (s.b - s.a) * p);
          if (recovery) { dur = round5(dur * 0.7); text = EASY[s.sport]; }
          else text = interp(s.text, p);
        }
        return { id: ds(n) + '_' + s.sport, sport: s.sport, title: s.title, dur: dur, text: text };
      });
      sessions.forEach(function (s) { if (s.dur) minutes += s.dur; count++; });
      days.push({ n: n, rest: null, sessions: sessions, race: isRace });
    }
    weeks.push({ i: i, ws: ws, wo: wo, phase: ph, p: p, recovery: recovery, days: days, minutes: minutes, count: count });
  }
  return { start: start, race: race, N: N, weeks: weeks };
}


export { buildPlan, normOv, eff, ds, dn, wd, fmtDur, fmtShort, unitFor, IDENT, DEFAULT_RACE, PLAN_START, SPORT };
