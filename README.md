# Music Theory

A personal, custom-built music-theory tutor — a React web app for teaching myself music theory through
tailored, interactive exercises. Built with [Claude Code](https://claude.com/claude-code).

It's a single-user tool that runs entirely in the browser. Sign-in is optional — without it there's
no backend or account and progress is stored locally on the device; with it your progress syncs across
devices. Live at **<https://ts95.github.io/music-theory/>**.

## Features

Lessons are organised into **selectable études**, each its own spaced-repetition session with its own
progress, chosen from a table-of-contents home screen. Twelve études today, in three sections:

### 🎹 Keys & Scales

- **No. 1 — Relative Minors.** Name the relative minor of a major key ("What is the relative minor of
  E♭ major?"); the circle of fifths is shown on reveal. Timed (5 s sudden-death).
- **No. 2 — Scales.** Spell the major and natural / harmonic / melodic minor scales of every key, across
  four ABRSM-graded levels (the key range widens from ≤2 sharps/flats at Easy to all 12 keys by Hard).
  **Expert** adds the Greek modes — Dorian, Phrygian, Lydian, Mixolydian, Locrian.
- **No. 3 — Play the Scale.** You're given a key and **play the scale ascending** on an interactive
  keyboard — tap/click, or strike a connected **MIDI keyboard**. Each correct note lights with its
  RH+LH fingering; a few wrong notes are forgiven (Easy/Medium two, Hard one, Expert none) before the run
  ends and reveals the whole scale. An optional **show-fingering** hint flashes the whole scale's finger
  numbers for 3 s (any key hides them) — but peeking grades the exercise as failed. Sudden-death;
  cumulative ABRSM-grade scope (Easy 1 octave / 15 s, Medium 2 / 20 s, Hard 2 / 18 s, Expert 2 / 12 s).
- **No. 4 — Key Signatures.** Name the sharps or flats of each key, across the full circle of fifths
  (15 major keys + relative minors) — **15 s sudden-death**. On reveal, a treble staff shows the key
  signature with just its sharpened/flattened notes and the keyboard highlights those keys (each
  labelled); C major / A minor show neither. Four ABRSM-style levels by key range — Easy ≤2 accidentals
  up to **Expert** at the seven-sharp/flat keys (C♯/C♭ major).

### 🎶 Chords & Harmony

- **No. 5 — Chords by Degree.** Recall the diatonic chord on a scale degree ("In C major, what is the
  IV chord?" → F), across every major and minor key — the common triads plus V7. Timed (5 s).
- **No. 6 — Chord Recognition.** Read a chord drawn on the staff (under its key signature) and name it
  as a symbol, with slash notation for inversions. Timed (10 s, +5 s when the chord is in an inversion).
- **No. 7 — Spell the Chord.** The inverse of Chord Recognition: read a chord **symbol** and pick its
  notes ("Spell the chord Cm7" → C – E♭ – G – B♭), drawn from the diatonic chords of every key. Choices
  share the root and differ only in quality. On reveal the chord is shown on a staff **beside** a piano
  keyboard with RH/LH fingerings. Untimed. Levels add sevenths then ninths and widen the key range.
- **No. 8 — Progressions.** Map a Roman-numeral progression to concrete chords ("In G major, spell
  ii–V–I" → Am – D – G), including ii–V–I seventh forms. The spelled chords are shown on a treble staff
  under the key's signature on reveal. Timed (15 s).

### 👂 Ear Training

- **No. 9 — Intervals by Ear.** Hear an interval and name it; the lower note is randomized each time
  (relative-pitch training). Optional hints — *step up to it* (walks the distance a semitone at a time)
  and *consonant or dissonant?* — plus a set of **reference songs**: a familiar tune for every interval,
  notated, that you can play to recognise the leap.
- **No. 10 — Progressions by Ear.** Hear the tonic, then a progression, and name it in Roman numerals.
- **No. 11 — Melodic Dictation.** Hear a short motif over its tonic and name it in **solfège**. A
  **hear-scale** hint plays the whole scale with a synced solfège readout (and you can hover a syllable
  to play just that note); the melody is shown on the staff, in key, on reveal. Miss it and the **whole
  scale** is shown as a solfège readout with the melody's notes marked in a distinct colour (so you can
  see where they sit in the scale and learn what each syllable means); it **auto-plays the missed melody**,
  lighting each note as it sounds, and you can hover any degree to hear that syllable on its own.
- **No. 12 — Rhythm Dictation.** Hear a one-bar rhythm and pick the matching notation. A wide vocabulary
  of common patterns — sixteenth cells (ti-tika / tika-ti), dotted-eighth and Scotch-snap figures, the
  tresillo (3+3+2), eighth-note triplets, ties, rests and off-beat syncopation. The metres accumulate
  with difficulty: Easy adds **2/4** (to 4/4, 3/4, 6/8), Medium adds **cut time (₵)** and **12/8**, Hard
  adds **5/4**, and **Expert** keeps the metres but pushes the tempo and density (full 32nd runs,
  continuous triplets, heavy syncopation); a count-in sets the tempo and metre. A **time-signature
  picker** lets you narrow practice to any subset of a level's metres (all on by default), remembered
  per level and synced across devices.
- **No. 13 — Tap the Rhythm.** The performance flip side of Rhythm Dictation: **read** a one-bar rhythm
  and **tap-and-hold it in time** (Space, press the screen, or any key of a connected **MIDI keyboard** —
  the pitch is irrelevant, only the rhythm) over a count-in and a steady metronome click on every beat. The **tempo is adjustable** (a 30–90 BPM slider, remembered per level); a count-in with a
  beat count (**1·2·3·4**) sets it, then the staff flashes **green** to mark the downbeat where your bar begins.
  The note head you're about to play **lights up** during the count-in (a silent preview) and on **Hear it** —
  never while you're tapping — and the **timing bars** below the staff can be hidden (the **Bars** toggle) to
  practise with less assistance. You're scored on timing accuracy — a little early or late still counts (a forgiving, flat ~200 ms window)
  — and each note must be **held for most of its length** (~70%, or ~40% for quick notes — sixteenths, thirty-seconds, triplets)
  to count, so a note is sustained, not clipped. The result colours each note
  **on the beat / a little off / missed or too short**, with **Hear it** to compare and **Try again** for a
  practice run (your first attempt is the one that's graded). On a connected **MIDI keyboard**, middle C
  begins / advances, B retries, and A plays it back. Same metres and four levels as Rhythm Dictation.

### Across the études

- 🎚️ **Difficulty levels.** Most études have four bands — **Easy / Medium / Hard / Expert** (remembered
  per étude), calibrated to the ABRSM grades (≈ 1–3 / 4–5 / 5–6 / 7–8+, adjusted per étude). Levels widen
  the key range and add harder material (compound intervals, longer/wider melodies, busier rhythms,
  sevenths/ninths, inversions) — cumulatively, so harder includes easier.
- 🔊 **Hover to hear it.** Hover any answer to play it on a synthesized piano — scales arpeggiate,
  chords ring as a block, progressions play chord-by-chord. Toggle with **♪ Sound**.
- 👆 **Touch-friendly.** Every hover preview also works by touch. **Press** an answer to hear it, **slide**
  across the options to scrub through them, and **release on one to choose it** — slide off and release to
  cancel. Single buttons commit on a normal tap. The mouse keeps single-click everywhere.
- 🎼 **See it on the staff.** Ear-training answers (and progression spellings) are rendered with VexFlow
  on reveal, under the correct key signature.
- 🧠 **Learn from misses.** Get one wrong (or let a timer run out) and a **Remember** note explains the
  rule, pattern, or mnemonic with a worked example. Each étude also has a collapsible **reference box**
  of the key facts (remembered open/closed).
- 🤷 **"I don't know."** A fifth option on every question: admit a blank instead of guessing. It reveals
  the answer and sends the scheduler the strongest "bring this back soon" signal.
- ⏱️ **Timed recall (optional).** Several categories are sudden-death (5–15 s); let the clock run out and it
  counts as a miss, so the scheduler resurfaces that item sooner. A header toggle (**⏱ Timed / Untimed**)
  turns the clock off entirely — answer at your own pace — and the choice is remembered.
- 🪶 **Gentle pacing.** Each étude serves at most **10 due cards per 5-hour window**, so a backlog never
  feels overwhelming.
- 📈 **Daily practice time.** Each étude tracks active minutes practiced **today** (it pauses when you
  switch away, and counts at most 15 s per question so idling on a card doesn't inflate it), with
  per-section and overall totals on the home screen; resets at midnight, or on demand per étude or
  globally.
- 📖 **About page.** A short explainer on how (and why) spaced repetition works.
- ☁️ **Optional sync.** Sign in with an **email magic link** to sync your SRS progress and practice time
  across devices. Signed out, everything stays local on the device.
- 📱 **Installable (PWA).** Add it to your home screen for a full-screen, app-like experience. Installed
  apps sign in with the **8-digit code** from the email (the magic link would open in the browser, a
  separate session); in a normal browser tab you still just click the link.

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

- **Levels** partition or widen an étude's material into Easy / Medium / Hard / Expert; each level keeps
  its own scheduling, so progress on one doesn't leak into another.
- **Timed recall** is sudden-death: Relative Minors and Chords by Degree (5 s), Chord Recognition (10 s,
  +5 s for inversions; Expert 8 s, 12 s for inversions), Progressions (15 s), plus Play the Scale's
  per-level clock. Other categories are untimed. The whole timer can be switched off with the
  **⏱ Timed / Untimed** header toggle.
- **Pacing** caps each étude at 10 due cards per rolling 5-hour window.
- **Sync:** progress lives in the browser's `localStorage`. Optionally **sign in** (email magic link,
  Supabase-backed) to sync progress and practice time across devices; signed out, the app stays fully
  local.

## Project structure

```
src/
├── theory/          # Pure music-theory domain (no React/DOM): notes, keys, scales,
│                    #   chords, recognition, fingerings, MIDI, ear-training realization
├── srs/             # SM-2-lite scheduler + localStorage / versioned-JSON persistence
├── supabase/        # Optional sign-in + cross-device sync (client, session, sync side-effects)
├── audio/           # The only Tone.js consumer (hover/ear playback, lazy-loaded)
├── questions/       # ETUDES registry + builds MC questions, explanations, distractors
├── components/      # React UI: review session, question card, staves, keyboard,
│                    #   circle of fifths, interval-song pages, about page, info box, auth controls
├── contracts.ts     # Shared domain + question types
├── intervalSongs.ts # Reference tunes + notes for each ascending interval
├── levels.ts · prefs.ts · dueCap.ts · time.ts · useEtudeTimer.ts · practiceHistory.ts
├── rhythm.ts · rhythmCounting.ts · tempos.ts · midi.ts (Web-MIDI input) · touch.ts
└── App.tsx          # Routing (one path per étude, /about, /interval-songs, /history) + shell
```

See [CLAUDE.md](./CLAUDE.md) for the architecture, conventions, and working principles used when
developing this project.

## Status

Early and evolving — built incrementally to fit how I actually want to learn.
