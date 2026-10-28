# Road to 70.3

A 33-week half Ironman (70.3) training plan that installs on an iPhone Home Screen and that two or more people can log together.

**Live app:** https://63csmith.github.io/road-to-703/

## What it does

- **Plan:** a week-by-week plan from Oct 26, 2026 to race day, made up of Foundation, Base, Build, Race-specific, Peak, Taper and Race week phases. Every fourth week is a recovery week.
- **Logging:** mark each day as Trained or Didn't train, and log time and distance for each workout.
- **Flexibility:** swap days within a week, switch any workout to another sport, or pick a travel option (bands, rower, gym bike, bodyweight).
- **Dashboard:** weekly hours against plan, a training calendar, time and distance by sport, and weekly distance.
- **Team:** everyone on a team can see each other's plans and dashboards, and the Team tab compares them side by side.
- **Offline:** the app keeps working without a connection and syncs changes when you're back online.

## Install on iPhone

1. Open the live app link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open **70.3** from your Home Screen, then start a team or enter a team code.

## How it's built

- One static page (`index.html`), with no build step and no frameworks.
- `sw.js` caches the app for offline use, and `manifest.webmanifest` and `icons/` make it installable.
- Data lives in a Supabase Postgres project. The tables have row-level security turned on and no direct access. The page talks only to a small set of functions (`create_team`, `join_team`, `get_team`, `set_log`, `set_week`, `update_member`), and each one checks the team code.
- The key in `index.html` is Supabase's public (publishable) key. It's safe to ship in a public repo because it can only call those functions.

### Data model

| Table | What it holds |
| --- | --- |
| `teams` | One row per team, with its 8-character code |
| `members` | Each person's name and race date |
| `logs` | One row per workout logged: done or skipped, plus optional minutes and distance |
| `week_changes` | Moved days and swapped workouts, one row per edited week |

### Updating

Edit `index.html`, bump `VERSION` in `sw.js`, and push to `main`. GitHub Pages redeploys in about a minute, and phones pick up the new version the next time the app opens online.

Free Supabase projects pause after a week with no activity. If that happens, restore the project from the Supabase dashboard.
