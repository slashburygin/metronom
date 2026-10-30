# Metronome

A browser metronome built on the Web Audio API with no runtime dependencies, published to Exordos as the
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
- Local PDF textbook or sheet music beside the metronome, with the browser's page and zoom controls. Files stay on device. On narrow screens the viewer sits below the controls; browsers without embedded PDF support can use the separate-tab link.
- Practice tab beside the metronome: Haimovich exercises for each weekday and daily chromatic exercises, with the current day selected automatically. Scores open at full size in a separate tab.
- Scales & chords practice: major, natural minor, harmonic minor and jazz melodic minor in 12 keys, with diatonic seventh chords, cadence guide tones and four guided steps. Progress is saved per key and scale type. Every task has a small help button with examples that follow the selected key. A tempo button sets the metronome to 60 BPM.
- Backing band in the cadence and improvisation steps: a four-bar ii–V–I, twelve-bar major or minor blues, straight, swing, bossa nova, ballad or rock feel, synthesized bass, keys and drums. Includes a one-bar count-in, 1/2/4/8 choruses or continuous playback, current-bar highlighting and individual volume/mute controls. Tempo is shared with the metronome; starting either player stops the other. Concert key and written instrument part are separate, with C, B♭, E♭, F and G instrument settings.
- Songs tab: create and duplicate songs, edit sections, meters, chord grids and comments, copy/paste bars, undo/redo and autosave drafts in IndexedDB. Chords support triads, sevenths, extensions, alterations, slash bass, N.C. and Break; unknown input remains in the draft and blocks playback. Multiple chords divide a bar equally or use explicit beat durations such as `Dm7:2 G7:2`. Alternate chords are displayed only. Custom songs play through the existing backing band with count-in, repeats and bar highlighting. See [song editor](docs/song-editor.md).
- Optional arrangement controls in both players: natural 9/13 chord colors for keys, style-specific fills before section changes, repeat/volta jumps and four-bar phrases, plus a short chorus ending. Source chords and bass stay intact; explicit extensions/alterations remain authoritative. Fills skip rests and share the saved performance seed.
- Sound controls in both players: synthesized piano, electric piano or organ; acoustic or electric bass; reverb amount. Settings persist per song and separately for exercises. Mixer mute also silences reverb, while pauses, stop, seek and finite endings cut effect tails. Changing sound stops playback.
- Song form: repeat signs, nested repeats, first/second/shared endings, D.C./D.S., Coda and Fine. Preview the expanded bar order before playback; invalid targets block playback while preserving the draft. Highlighting follows source bars, and automatic practice changes key/tempo after the entire form. See [form rules](docs/song-editor.md#репризы-и-переходы).
- Local song library: versioned IndexedDB storage with non-destructive migration from localStorage, search by title/composer/key, recoverable trash, and JSON export/import. Stable IDs and revision ancestry allow manual transfer between devices: newer versions update existing songs, divergent changes retain both copies, and repeated imports do not duplicate known conflicts. Cross-tab writes use optimistic concurrency checks; unfinished writes have a local recovery journal. Account-based server sync is not implemented yet.
- Transposition and automatic practice: keep original chords while changing concert key and written part, cycle keys by semitone or fourth after N choruses, and increase BPM to a limit. Both players save training settings. The Songs editor can also transpose source chords as an undoable edit.
- Shared accompaniment arranger for exercises and songs: close-position chord inversions minimize voice movement, swing uses walking bass with chromatic approaches, slash bass and pauses remain explicit. A saved performance variation number reproduces velocity changes without changing timing.
- Production PWA: after the offline-ready message, reopen the app without a network connection to use the metronome, backing band, song library and all 24 practice pages. Install from the browser menu where supported. Updates wait for all app tabs/windows to close. External fonts and analytics are not cached; local PDFs must be selected again. See [offline behavior](docs/song-editor.md#офлайн-приложение).
- Settings are saved in the browser; **Reset** restores the defaults
- Keyboard: `Space` start/stop, `↑`/`↓` ±1 BPM (`Shift` ±5), `T` tap

Timing uses a lookahead scheduler: clicks are placed on the audio clock ahead of time, and the
scheduler runs in a Worker so it keeps time in background tabs.

The metronome uses the shared `Transport` for timing and source cancellation. BPM counts the
selected denominator note. The song model additionally supports independent tempo units,
mixed meters and pulse grouping. See [music model and transport](docs/music-transport.md)
for the API, count-in, looping, and seeking contracts.

## Layout

| Path | Purpose |
|---|---|
| `site/` | App HTML and source modules, used as the Vite root. |
| `site/public/` | Static resources copied unchanged to `/`, including lesson scores. |
| `scripts/offline-plugin.js` | Generates a versioned Service Worker from the finished production files and their SHA-256 hashes. |
| `scripts/service-worker.js` | Verifies and caches each release; bypasses APIs and external requests. |
| `site/src/offline.js` | Production registration and localized offline/update status. |
| `dist/site/` | Production build, packed as `site.tar.zst`. |
| `site/src/notation.js` | Draws a rhythm pattern as notation: noteheads, stems, beams, dots, tuplets. |
| `site/src/musical-time.js` | Exact fractional musical durations and conversion to seconds. |
| `site/src/song.js` | Validates source songs, pulse grids and form playback order. |
| `site/src/song-form.js` | Repeat/ending/jump validation and finite playback expansion with source mappings. |
| `site/src/transport.js` | Shared audio-clock scheduling, count-in, loops, seeking, and source lifecycle. |
| `site/src/accompaniment.js` | Practice forms and exact musical events for bass, keys and drums. |
| `site/src/backing-player.js` | Procedural audio voices, mixer and repeated accompaniment playback. |
| `site/src/backing-sound.js` | Timbre profiles, sound settings and deterministic stereo room impulse. |
| `site/src/backing-reverb.js` | Per-part convolution returns with audio-clock boundaries and cleanup. |
| `site/src/sound-controls.js` | Shared bilingual timbre and reverb controls. |
| `site/src/practice-player.js` | Bilingual backing-band controls and current-bar display. |
| `site/src/transposition.js` | Key-aware spelling, chord/slash-bass transposition and source-preserving chart transforms. |
| `site/src/training.js` | Per-chorus key and tempo plans shared by both players. |
| `site/src/training-controls.js` | Bilingual training controls and written/concert key labels. |
| `site/src/chords.js` | Explicit chord vocabulary, alterations, slash bass and silence markers. |
| `site/src/song-draft.js` | Raw draft validation, exact bar durations, history and saved-draft schema. |
| `site/src/song-arrangement.js` | Shared style patterns, intra-pulse chord changes and mixed meters. |
| `site/src/arrangement.js` | Voice leading, walking bass, style names and seeded variations. |
| `site/src/arrangement-controls.js` | Shared performance variation and optional colors/fills controls. |
| `site/src/arrangement-ornaments.js` | Conservative chord colors and seeded phrase/transition/ending figures. |
| `site/src/song-editor.js` | Local library, editing UI, autosave, JSON exchange and playback. |
| `site/src/song-library.js` | Song revisions, legacy migration, backup validation, search and conflict-preserving merges. |
| `site/src/library-storage.js` | IndexedDB transactions, write serialization, cross-tab concurrency and recovery journal. |
| `site/src/select.js` | Dropdown listbox, so the popup follows the site's tokens instead of the OS. |
| `test/` | Unit tests for the tempo logic (`node --test`). |
| `vite.config.js` | Development server and production build configuration. |
| `exordos/exordos.yaml` | Build configuration of the element. |
| `exordos/manifests/metronom.yaml.j2` | The element: its organization, project and owner user, plus one route on the realm core LB vhost. |
| `exordos/pack_site.sh` | Builds and checks production content before packing. |
| `exordos/artifacts/` | Element store icon and previews. |
| `.github/workflows/build.yml` | Tests and builds the element on a GitHub-hosted runner. |

## Run locally

```sh
npm ci         # Node.js 20.19+ in the 20.x line, or 22.12+
npm start      # Vite dev server at http://localhost:8000; npm run dev is equivalent
npm test
npm run build  # production files in dist/site/
npm run preview # serve the production build at http://localhost:8000
```

`make run` starts the same dev server. Set `PORT` to change the dev/preview port.
You need a server because ES modules don't load over `file://`.

## Exordos element

The element serves `site/` from the load balancer the realm core already runs, so it needs no VM,
certificate or DNS record of its own. After `npm ci`, `exordos build` runs the Vite build and archives `dist/site/` into `site.tar.zst` next to
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

`.github/workflows/build.yml` runs on `ubuntu-latest` on every push. It installs frontend dependencies with `npm ci`, runs the tests, installs
the Exordos CLI, then builds and publishes the element in one step, and uploads `output/` as a
workflow artifact. The publish half is skipped on pull requests and when the `PUSH_CFG` secret is
missing; that secret holds the base64 of an `exordos push` config.

## Practice materials

`site/public/lessons/haimovich/schedule.json` maps weekdays (1 = Monday, 0 = Sunday) to
sessions and printed page numbers. The daily block appears on every day, including Sunday.
Printed pages 35–58 correspond to PDF pages 37–60 in the supplied textbook.
`page-35.webp` through `page-58.webp` preserve the original scores and instructions as
lossless images rendered at 2000 pixels high. The app loads images lazily; the full
source PDF is not served. To edit the schedule, change the JSON; to replace a score,
replace its image. These textbook extracts retain their original authorship and are
separate from the application code's license.

`site/src/harmony.js` generates diatonically spelled major/minor scales and seventh chords;
`site/src/scale-practice.js` contains the bilingual practice steps and progress interface.
`site/src/practice-help.js` provides the task popovers, rhythm grids and transposed examples.
Jazz melodic minor uses the same raised sixth and seventh in both directions.
The natural-minor chord table stays diatonic; the practice cadence uses V7 from
harmonic minor, with an explanation of its raised leading tone.
