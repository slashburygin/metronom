# Metronome

A browser metronome built on the Web Audio API with no dependencies, published to Exordos as the
`metronom` element. The feature set follows metronome-online.org and metronome-online.com, and the
styling follows exordos.com.

## Features

- Tempo from 30 to 300 BPM: slider, number field, −/+ buttons, tap tempo, and the Italian tempo name
- Time signature from 1/1 to 32/32
- 11 rhythm patterns picked as musical notation: eighths, triplets, sixteenths, dotted notes, mixed
  groupings, swing, sextuplets. Each picture is drawn from the same onsets the scheduler plays.
- Accent per beat: click a beat to cycle accent → normal → mute, plus a stress-first-beat checkbox
- 8 sounds (click, beep, wood block, drum, tick, cowbell, hi-hat, ping) and 5 pitch levels
- Digital or animated pendulum display, and a fullscreen mode
- Practice timer: stops the run after 1 to 60 minutes, with a countdown while it plays
- Chromatic microphone tuner (50–1500 Hz): note, frequency and cents, with A4 = 440 Hz; audio stays on device. Requires HTTPS or localhost.
- Russian/English interface, light/dark theme
- Settings are saved in the browser; **Reset** restores the defaults
- Keyboard: `Space` start/stop, `↑`/`↓` ±1 BPM (`Shift` ±5), `T` tap

Timing uses a lookahead scheduler: clicks are placed on the audio clock ahead of time, and the
scheduler runs in a Worker so it keeps time in background tabs.

## Layout

| Path | Purpose |
|---|---|
| `site/` | The app. Everything here is served at `/`. |
| `site/src/notation.js` | Draws a rhythm pattern as notation: noteheads, stems, beams, dots, tuplets. |
| `site/src/select.js` | Dropdown listbox, so the popup follows the site's tokens instead of the OS. |
| `test/` | Unit tests for the tempo logic (`node --test`). |
| `server.js` | Static server for local development. |
| `exordos/exordos.yaml` | Build configuration of the element. |
| `exordos/manifests/metronom.yaml.j2` | The element: its organization, project and owner user, plus one route on the realm core LB vhost. |
| `exordos/pack_site.sh` | Runs before packing; checks the content is in place. |
| `exordos/artifacts/` | Element store icon and previews. |
| `.github/workflows/build.yml` | Tests and builds the element on a GitHub-hosted runner. |

## Run locally

```sh
npm start      # http://localhost:8000
npm test
```

You need a server because ES modules don't load over `file://`.

## Exordos element

The element serves `site/` from the load balancer the realm core already runs, so it needs no VM,
certificate or DNS record of its own. `exordos build` archives `site/` into `site.tar.zst` next to
the manifest. The route's `local_dir_download` action tells the LB agent to fetch that archive and
serve it at `/`, while `/api/core/` stays with the realm API. The route claims `/`, so no other
element serving `/` can go in the same realm.

```sh
exordos build -f .                 # render the manifest and pack site/ into output/
exordos push                       # upload the element to the repository
exordos elements install metronom
```

The metronome is then at `https://<realm>.exordos.com/`. The version comes from git: an untagged
commit builds as `0.0.1-rc+<stamp>`, and a commit tagged `1.0.0` builds as `1.0.0`.

### CI

`.github/workflows/build.yml` runs on `ubuntu-latest` on every push. It runs the tests, installs
the Exordos CLI, then builds and publishes the element in one step, and uploads `output/` as a
workflow artifact. The publish half is skipped on pull requests and when the `PUSH_CFG` secret is
missing; that secret holds the base64 of an `exordos push` config.
