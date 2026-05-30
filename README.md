# Music Theory

A personal, custom-built music-theory tutor — a React web app for teaching myself music theory through
tailored, interactive exercises. Built with [Claude Code](https://claude.com/claude-code).

It's a single-user tool with no backend and no accounts. Everything runs in the browser; progress is
stored locally and can be exported to a file. Live at **<https://ts95.github.io/music-theory/>**.

## Features

Lessons are organised into **selectable études**, each its own spaced-repetition session with its own
progress, chosen from a table-of-contents home screen. Ten études today, in three sections:

### 🎹 Keys & Scales

- **No. 1 — Relative Minors.** Name the relative minor of a major key ("What is the relative minor of
  E♭ major?"); the circle of fifths is shown on reveal. Timed (5 s sudden-death).
- **No. 2 — Scales.** Spell the natural / harmonic / melodic minor scales of every key.
- **No. 3 — Scale Fingerings.** Standard two-octave piano fingerings, **both hands at once** (RH over
  LH), with a wide gap marking each thumb-tuck / cross-over. The reveal lights the scale across two
  octaves on a keyboard, labelled with both hands' finger numbers.

### 🎶 Chords & Harmony

- **No. 4 — Chords by Degree.** Recall the diatonic chord on a scale degree ("In C major, what is the
  IV chord?" → F), across every major and minor key — the common triads plus V7. Timed (5 s).
- **No. 5 — Chord Recognition.** Read a chord drawn on the staff (under its key signature) and name it
  as a symbol, with slash notation for inversions. Timed (10 s).
- **No. 6 — Progressions.** Map a Roman-numeral progression to concrete chords ("In G major, spell
  ii–V–I" → Am – D – G), including ii–V–I seventh forms. The spelled chords are shown on a treble staff
  under the key's signature on reveal. Timed (15 s).

### 👂 Ear Training

- **No. 7 — Intervals by Ear.** Hear an interval and name it; the lower note is randomized each time
  (relative-pitch training). Optional hints — *step up to it* (walks the distance a semitone at a time)
  and *consonant or dissonant?* — plus a set of **reference songs**: a familiar tune for every interval,
  notated, that you can play to recognise the leap.
- **No. 8 — Progressions by Ear.** Hear the tonic, then a progression, and name it in Roman numerals.
- **No. 9 — Melodic Dictation.** Hear a short motif over its tonic and name it in **solfège**. A
  **hear-scale** hint plays the whole scale with a synced solfège readout (and you can hover a syllable
  to play just that note); the melody is shown on the staff, in key, on reveal.
- **No. 10 — Rhythm Dictation.** Hear a one-bar rhythm and pick the matching notation. Covers 4/4, 3/4
  and 6/8, with triplets, dotted notes, ties, rests and up to 32nd notes; a count-in sets the tempo and
  metre.

### Across the études

- 🎚️ **Difficulty levels.** Most études have **Easy / Medium / Hard** (remembered per étude). Levels
  widen the key range, add harder material (wider intervals, longer motifs, busier rhythms, sevenths /
  inversions), or use the ABRSM grade-1/2 key sets — cumulatively, so harder includes easier.
- 🔊 **Hover to hear it.** Hover any answer to play it on a synthesized piano — scales arpeggiate,
  chords ring as a block, progressions play chord-by-chord. Toggle with **♪ Sound**.
- 🎼 **See it on the staff.** Ear-training answers (and progression spellings) are rendered with VexFlow
  on reveal, under the correct key signature.
- 🧠 **Learn from misses.** Get one wrong (or let a timer run out) and a **Remember** note explains the
  rule, pattern, or mnemonic with a worked example. Each étude also has a collapsible **reference box**
  of the key facts (remembered open/closed).
- 🤷 **"I don't know."** A fifth option on every question: admit a blank instead of guessing. It reveals
  the answer and sends the scheduler the strongest "bring this back soon" signal.
- ⏱️ **Timed recall.** Several categories are sudden-death (5–15 s); let the clock run out and it counts
  as a miss, so the scheduler resurfaces that item sooner.
- 🪶 **Gentle pacing.** Each étude serves at most **10 due cards per 5-hour window**, so a backlog never
  feels overwhelming.
- 📈 **Daily practice time.** Each étude tracks active minutes practiced **today** (it pauses when you
  switch away), with per-section and overall totals on the home screen; resets at midnight.
- 📖 **About page.** A short explainer on how (and why) spaced repetition works.
- 💾 **Progress that's yours.** Saved to your browser, with versioned JSON **export/import** to back up
  or move between devices.

## Tech stack

Vite · React · TypeScript (strict) · Tailwind CSS · Tone.js (audio) · VexFlow (notation). Unit tests with
Vitest, browser tests with Playwright.

## Getting started

Prerequisites: **Node.js 20+**.

```bash
npm install      # install dependencies
npm run dev      # start the dev server, then open the printed localhost URL
```

Other commands:

```bash
npm run build      # production build
npm run preview    # preview the production build locally
npm run test       # Vitest unit tests (theory/ + srs/ + helpers)
npm run test:e2e   # Playwright browser smoke tests (auto-starts the dev server)
```

## How it works

Every fact you study — a key relationship, a scale's notes, a fingering, a chord, an interval, a rhythm —
is a separately scheduled card under an **SM-2-style** spaced-repetition scheduler. Answer well and the
interval to the next review grows; miss it (or hit "I don't know") and it comes back soon, with the ease
dropped further the more confidently you blanked.

- **Levels** partition or widen an étude's material into Easy / Medium / Hard; each level keeps its own
  scheduling, so progress on one doesn't leak into another.
- **Timed recall** is sudden-death: Relative Minors and Chords by Degree (5 s), Chord Recognition (10 s),
  Progressions (15 s). Other categories are untimed.
- **Pacing** caps each étude at 10 due cards per rolling 5-hour window.
- **Backup & sync:** progress lives in the browser's `localStorage`. **Export** downloads a versioned
  JSON snapshot; **Import** restores it on a new browser or device.

## Project structure

```
src/
├── theory/          # Pure music-theory domain (no React/DOM): notes, keys, scales,
│                    #   chords, recognition, fingerings, MIDI, ear-training realization
├── srs/             # SM-2-lite scheduler + localStorage / versioned-JSON persistence
├── audio/           # The only Tone.js consumer (hover/ear playback, lazy-loaded)
├── questions/       # ETUDES registry + builds MC questions, explanations, distractors
├── components/      # React UI: review session, question card, staves, keyboard,
│                    #   circle of fifths, interval-song pages, about page, info box
├── intervalSongs.ts # Reference tunes + notes for each ascending interval
├── levels.ts · prefs.ts · dueCap.ts · time.ts · useEtudeTimer.ts · rhythm.ts
└── App.tsx          # Routing (one path per étude, /about, /interval-songs) + shell
```

See [CLAUDE.md](./CLAUDE.md) for the architecture, conventions, and working principles used when
developing this project.

## Status

Early and evolving — built incrementally to fit how I actually want to learn.
