# School Lunch Evening Push

Nightly push notification with tomorrow's lunch entree at Poplar Bridge
Elementary. No UI, no app to open — see the top-level build spec this was
built from for full rationale.

## How it works

`fetch_lunch.py` runs on a GitHub Actions cron (`.github/workflows/nightly.yml`,
`0 1 * * 0-4` UTC = evening Sun-Thu), calls the public LINQ Connect API for
tomorrow's menu, pulls out the Lunch session's entree recipe(s), and pushes a
notification via [Pushover](https://pushover.net).

If there's no school tomorrow (weekend, holiday, summer), the LINQ response
won't have a matching session/day/entree and the script exits 0 without
sending anything — that's expected, not a failure. A genuine failure (LINQ or
Pushover unreachable, or a bad ID) exits non-zero so the Actions run shows red.

## The two LINQ GUIDs

`BUILDING_ID` and `DISTRICT_ID` in `fetch_lunch.py` are not secrets (they're
visible in any browser's Network tab on a public page), so they're hardcoded
constants rather than repo secrets.

To find them (one-time, manual):

1. Open `https://linqconnect.com/public/menu/2G6H2N` (Poplar Bridge) in a
   desktop browser.
2. Open DevTools → **Network** tab, filter on `FamilyMenu`.
3. Reload the page.
4. Click the `FamilyMenu` request and read `buildingId` and `districtId` off
   the request URL / query string. Both are GUIDs, e.g.
   `23125610-cbbc-eb11-a2cb-82fe13669c55`.
5. Paste them into the `BUILDING_ID` / `DISTRICT_ID` constants at the top of
   `fetch_lunch.py`.

These are stable for the school year and won't need to be re-derived until
Poplar Bridge changes LINQ tenants (rare).

**Filled in for this repo:**

- `BUILDING_ID`: _(not yet set — see fetch_lunch.py)_
- `DISTRICT_ID`: _(not yet set — see fetch_lunch.py)_

## Required repo secrets

Set these under Settings → Secrets and variables → Actions:

| Secret | Purpose |
|---|---|
| `PUSHOVER_TOKEN` | Pushover application token |
| `PUSHOVER_USER` | Pushover user key |

## Testing

1. Fill in the two GUIDs above.
2. Set the two Pushover secrets.
3. Trigger the workflow manually from the Actions tab (`workflow_dispatch`)
   on a school night and confirm the push arrives with the correct entree.
4. To confirm the "no school" path is quiet rather than red, run it against
   a Friday/holiday-eve date and confirm the run is green with no push sent.
5. To confirm failures page loudly, temporarily set `BUILDING_ID` to garbage
   and confirm the run goes red.

## Known open item

LINQ may not distinguish "no school" from "menu not yet published" — if a
fall menu is published late in the summer, a run could go quiet for reasons
other than no-school with no way to tell the difference from the push alone.
Check the raw response in the Actions log if a string of quiet nights seems
suspicious.
