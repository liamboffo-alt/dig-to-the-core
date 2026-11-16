# Dig to the Earth's Core

An incremental game with one absurd goal: dig a hole 6,371 km straight down, starting with a spoon.

Dig, sell what you find, buy better tools and helpers, hit a wall, rebirth with a permanent
multiplier, and go deeper each time until you reach the core. Solo play saves in the browser;
co-op lets a room of people dig one shared hole on a small Node server.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (port 5173). Tap or hold on the pit to dig; Space also works.

Co-op needs the game server as well, in a second terminal:

```bash
npm run server
```

Then use More → Co-op → Create a room, and give the code to a friend on the same network
(they open `http://<your-ip>:5173`).

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for the simulation and the co-op server |
| `npm run balance` | Headless scripted player; prints time to each milestone (`-- --seed 7 --verbose`) |
| `npm run autotune` | Suggests layer hardness and barrier numbers for a pacing schedule |
| `node scripts/browser-check.mjs` | Headless Chromium: loads, digs, buys, reloads, checks for console errors |
| `node scripts/browser-tour.mjs` | Headless tour of barriers, layers, rebirth, offline earnings, the ending |
| `node scripts/browser-coop.mjs` | Two headless browsers in one room (needs `npm run server`) |

The three browser scripts need Playwright (`npm i -D playwright && npx playwright install chromium`)
and a running dev server.

## Deploy it

**Solo only (static hosting).** `npm run build` writes a static site to `dist/`. Put it on any
static host (Netlify, GitHub Pages, S3...). Asset paths are relative, so a sub-folder works.

**With co-op (one Node process).** The server also serves the built client, so one process is enough:

```bash
npm run build
npm run build:server
PORT=8787 npm start
```

Open `http://your-host:8787`. Environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | HTTP and WebSocket port |
| `DATA_FILE` | `server/data/rooms.json` | Where rooms and leaderboards are saved (every 30 s and on shutdown). Put it on a persistent disk. |
| `STATIC_DIR` | `dist` | Built client to serve |

Behind HTTPS, proxy WebSocket upgrades to the same port; the client picks `wss://` by itself.
To host the client somewhere else, build it with `VITE_WS_URL=wss://your-server npm run build`.
`GET /health` reports room and player counts.

## How the code is laid out

```
src/data/      Every balance number and all content. Edit these to tune or add things.
src/sim/       The game itself: pure, deterministic functions over plain data. No DOM, no clock.
src/game/      Sessions: solo (runs the sim in the page, saves to localStorage) and co-op (mirrors the server).
src/render/    Three.js scene, generated low-poly models, particles, camera shake.
src/audio/     Web Audio synthesis. There are no asset files anywhere in the project.
src/ui/        HUD, panels, toasts, modals (plain DOM over the canvas).
src/shared/    The co-op wire protocol.
server/        Node WebSocket server: rooms, shared hole, leaderboards. Runs src/sim.
scripts/       Balance simulation, auto-tuner, headless browser checks.
tests/         Vitest unit tests.
```

The simulation takes time as `dt` and draws randomness from a seed stored on the player, so the
same inputs always give the same game. The browser, the tests, the balance script and the server
all run that one module. In co-op the client sends only intent (holding, tap, buy, rebirth) and
the server decides every number.

## Tuning and adding content

Everything below is a data edit. After changing numbers, run `npm run balance` to see what it
did to the pacing, and `npm test` (the data sanity tests catch broken tables).

### Add a tool

Append a row to `src/data/tools.ts`:

```ts
{ id: 'starlance', name: 'Star Lance', desc: 'Borrowed from a neutron star.',
  power: 4e12, cost: 5e31, model: 'lance', anim: 'beam',
  color: 0xfff176, glow: 0xff5252, shake: 1, sound: 'boom' },
```

`power` is damage per hit and `cost` is cash; the existing tiers go about x6.3 power for x100
cost. `model` picks a generated 3D model from `src/render/tools.ts` (`spoon`, `shovel`,
`pickaxe`, `jackhammer`, `drill`, `borer`, `laser`, `sonic`, `lance`, `auger`, `singularity`,
`quantum`, `cracker`); reuse one with new colours, or add a builder there for a new shape.
`sound` is one of `thud`, `clink`, `rattle`, `grind`, `zap`, `boom`.

### Add an ore

Add it to `src/data/ores.ts`, then list it in a layer's `ores` in `src/data/layers.ts`:

```ts
{ id: 'opal', name: 'Opal', color: 0xb2dfdb, value: 30 },      // ores.ts
ores: [ ...std('quartz', 'emerald', 'ruby', 'diamond'), { id: 'opal', weight: 5 } ],   // layers.ts
```

`value` multiplies the cash of the hit that uncovered it; `weight` is its share of that layer's drops.

### Add a layer

Insert a row in `src/data/layers.ts`. Keep `start`/`end` contiguous and the last layer ending at
the core depth.

- `hardness` / `hardnessEnd`: damage per metre at the top and bottom of the layer. It rises
  smoothly in between.
- `value`: cash per point of damage.
- `barrier`: the wall at the bottom. Its `hp` must be emptied inside 20 seconds
  (`BALANCE.barrier.burstSeconds`) or it regenerates.
- `look`: colours for wall, floor, fog, debris and how much the layer glows.

Then run `npm run autotune` for suggested hardness and barrier numbers, and add rare finds for
the new layer in `src/data/finds.ts` if you want it to have a collection set.

### Everything else

| File | What is in it |
| --- | --- |
| `balance.ts` | Global constants: hit speed, combo, crit, loot chances, barrier window, offline rules, rebirth formula |
| `upgrades.ts` | Repeatable cash upgrades (cost, growth, cap, effect) |
| `helpers.ts` | Auto-diggers |
| `prestige.ts` | The rebirth tree |
| `finds.ts` | Rare finds and collection sets |
| `milestones.ts`, `achievements.ts` | Depth rewards and achievements |
| `planets.ts` | Planets after Earth: multipliers on the layer table plus rule changes |

Effects are all the same shape, `{ stat, op: 'add' | 'mult', value }`, and are combined in one
place (`collectModifiers` in `src/sim/stats.ts`).

## Balance

`npm run balance` plays the real simulation with a scripted player who holds the dig button,
buys whatever pays back fastest, and rebirths when progress stalls. Current numbers, three seeds:

| Target | Result |
| --- | --- |
| First upgrade inside 30 s | 1 to 9 s |
| First new layer inside 5 min | 3:15 to 4:15 |
| First rebirth at 20 to 30 min | 18:30 to 25:00 |
| Core after several hours | 3:54 to 4:12, 17 rebirths |
| Longest wait with nothing new to buy or unlock | 27 to 36 s |

That player never stops digging and never hesitates, so a person will be slower. Planet 2
(Vulcan Prime) is playable but has not had a balance pass.

`npm run autotune` is how the layer numbers were derived: you state how long runs should last
and where each should end (constants at the top of `scripts/autotune.ts`), and it fits hardness
and barrier hp to the scripted player's damage curve. It prints numbers and does not write files.

## Designed for later

These are not built, but the data model has room for them, so they should not need rewrites:

- **Pets, events, cosmetics, quest rewards.** Anything that changes a stat pushes a modifier
  into `player.ext.modifiers`; the stat pipeline already applies it. `player.ext` also has typed
  slots for `pets`, `quests`, `daily`, `cosmetics`, `events` and `trades`, and saves fill in
  missing fields on load, so adding to them does not break old saves.
- **Daily rewards and timed events.** The simulation never reads a clock. Pass the date in from
  the session (or the server, which is the only trustworthy clock in co-op).
- **New planets with different rules.** `planets.ts` has a `rules` object per planet (barrier
  window, helper and tap multipliers so far). A planet with its own layer table needs a `layers`
  field there and a lookup in `src/sim/world.ts`, which is the only file that reads the table.
- **Trading.** Needs server-side inventory moves between two members of a room; `server/server.ts`
  already owns every player's state, so it is one more message type in `src/shared/protocol.ts`.

## Known rough edges

- Ores sell automatically the moment they are found; there is no inventory or sell button.
- Co-op has no accounts. Identity is a random token in localStorage, so clearing browser data
  loses your seat in a room. There are no offline earnings in co-op.
- A dropped co-op connection does not reconnect by itself: rejoin with the room code.
- Rooms are kept in one JSON file, which is fine for a small server and nothing more.
