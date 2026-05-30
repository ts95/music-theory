# CLAUDE.md

Guidance for Claude (and any AI agent) working in this repository.

## What this project is

A **personal, single-user music-theory tutor** — a React web app that Toni uses to teach himself music
theory. It is vibe-coded with Claude Code. There is no backend, no accounts, no other users: optimize
for Toni's learning, not for generality.

Toni already knows the basics (notes, the major scale) and wants to go deeper.

**First feature (current focus):** a spaced-repetition (SRS) exercise for **major keys and their
relative minors**. Question families:
1. Relationship recall — e.g. "What is the relative minor of E♭ major?" (multiple choice)
2. Scale spelling — "What are the notes of E♭ **natural / harmonic / melodic** minor?" (multiple choice)
3. **Piano** fingerings — standard RH/LH fingerings for each scale (multiple choice)

---

## Working principles

These set the tone for how Claude works in this repo. Follow them on every task.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant
clarification.

---

## Git workflow

Use git **proactively**:
- Commit in small, logical units as features land (e.g. "scaffold Vite app", "add theory/keys +
  scales", "add SRS scheduler", "wire up review UI"), with clear messages.
- For non-trivial features, work on a short-lived branch and commit there before merging to `main`.
- Don't bundle unrelated changes into one commit.

---

## Tech stack

- **Vite + React + TypeScript** (strict mode) — fast dev loop, typed domain model.
- **Tailwind CSS** — utility-first styling.
- **Tone.js** — audio playback (hear a scale/interval). Used progressively.
- **VexFlow** — staff notation rendering. Used progressively.

The multiple-choice exercise works without audio/notation; Tone.js and VexFlow make questions richer
and are layered in over time, not required for the MVP.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server (local development)
npm run build      # production build
npm run preview    # preview the production build
npm run test       # vitest unit tests (theory/ + srs/)
npm run test:e2e   # Playwright browser tests (auto-starts the dev server)
npm run test:e2e:ui# Playwright in headed/inspector mode (debugging)
```

## Project structure

```
src/
├── theory/          # PURE music-theory domain — no React, no DOM. The source of truth.
│   ├── notes.ts     # pitch/note model, enharmonics, accidentals
│   ├── keys.ts      # 12 major keys, key signatures, relative-minor mapping
│   ├── scales.ts    # compute natural/harmonic/melodic minor note spellings
│   ├── chords.ts    # diatonic triads/sevenths, chord symbols, Roman-numeral mapping
│   ├── midi.ts      # pure note/scale/chord/progression → MIDI events (for playback)
│   ├── eartraining.ts# realize interval/progression specs → voiced notes (audio + notation)
│   └── fingerings.ts# static RH/LH piano fingering tables per scale
├── srs/             # Spaced-repetition engine — also framework-free
│   ├── scheduler.ts # SM-2-lite: per-item ease + interval, grade 0–5
│   └── store.ts     # localStorage load/save + JSON export/import
├── audio/
│   └── player.ts    # the ONLY Tone.js consumer — hover-to-play (lazy-loaded)
├── questions/
│   ├── etudes.ts    # ETUDES registry (the selectable exercises)
│   └── generators.ts# build MC questions from theory/ data; produce distractors
└── components/      # React UI
    ├── EtudeMenu.tsx     # table-of-contents home screen; picks an étude
    ├── ReviewSession.tsx  # drives a study session: pick due item → render → grade
    ├── QuestionCard.tsx   # renders one MC question + answer feedback
    └── Staff.tsx         # VexFlow staff notation (lazy-loaded; ear-training reveal)

tests/e2e/           # Playwright browser tests (smoke.spec.ts). Config: playwright.config.ts (root).
```

**Études:** the app is organised into selectable études (exercises). `ETUDES` (in `questions/etudes.ts`)
lists them; every `Question` carries an `etudeId`, and the UI scopes a session + its progress to one
étude. To add an étude: add an `ETUDES` entry, generate questions tagged with its id, done.

**Keep the README current:** `README.md` carries the public feature list and étude roster. Update it
periodically — whenever you add an étude or a notable feature — so it doesn't drift out of date.

**Hover-to-play audio:** generators attach a `Question.audio` map (choice string → `Playable` of MIDI
events) computed via `theory/midi.ts` — never parse display strings back into pitches. `audio/player.ts`
is the only Tone.js consumer (dynamically imported, synthesized PolySynth); QuestionCard calls
`play`/`stop` on row hover. Keep audio data generated upstream, not derived in the UI.

**Practice time** (`src/time.ts` + `src/useEtudeTimer.ts`): per-étude seconds for *today only*, in
localStorage. Reset at local midnight is **lazy** — any read/write whose stored date ≠ today starts fresh
(no background timer). `useEtudeTimer(etudeId, exerciseKey?)` accrues active time (tab visible + interaction
within ~60s) while an étude screen is open and returns today's live seconds plus a `reset()`; shown on the
menu rows and the étude header. To guard against idling on the étude screen, **at most 15 s is counted per
exercise** — pass the current question id as `exerciseKey` and the budget resets when it changes. Users can
clear time per étude (header) or globally (menu) via `resetEtudeSeconds` / `resetAllSeconds`. Keep it
presence-based and independent of SRS/grading.

**Ear-training études** (`ear?: EarSpec` on a Question): the *question* owns the audio (not the choices).
`theory/eartraining.ts` `realizeEar(spec, root)` turns a relative spec into voiced notes from a root the
UI picks at random each presentation (relative-pitch training); the same voiced notes drive both
playback (`playEar`) and the VexFlow `Staff` shown on reveal. No hover audio, no timer, deterministic bank
(randomness is presentation-only). VexFlow and Tone are both lazy-loaded (code-split).

**Memory tips:** each `Question` carries an `explanation` (rule + worked example) built deterministically
in `questions/explanations.ts` from the theory data. QuestionCard shows it only when the answer is missed
(wrong pick or timeout). Keep tips computed upstream and accurate — never hand-wave the music.

**Distractor design (keep questions hard):** no single surface feature should reveal the answer by
elimination. Chords: include a same-root/different-quality distractor *and* same-quality/different-root
distractors (so neither root nor quality is a giveaway). Scales: all options share the same first note
(tonic) and mix scale types (sibling minor forms + parallel major / Dorian / Phrygian), varied per
question. Progressions: include a same-key variant that starts on the same first chord. Selection is
deterministic (no RNG — SRS ids must stay stable); vary the mix with a stable index, not randomness.

**Key rule: `theory/` and `srs/` are pure** — no React, no DOM, no side effects beyond `store.ts`'s
localStorage access. This keeps the music logic testable and reusable.

## Music-theory correctness guardrails

Accuracy matters more than cleverness — a wrong fact teaches the wrong thing.

- **Keys covered:** the 12 practical major keys, one spelling per pitch:
  `C, G, D, A, E, B, F, B♭, E♭, A♭, D♭, F♯` (use D♭ not C♯, etc.). Each with its relative minor.
- **Relative minor** = the 6th degree of the major scale (down a minor third from the tonic).
  E.g. relative minor of E♭ major is C minor.
- **Minor scale formulas** (compute, don't hand-type, in `scales.ts`):
  - Natural minor: W–H–W–W–H–W–W
  - Harmonic minor: natural minor with a raised 7th
  - Melodic minor: natural minor with raised 6th and 7th ascending (descending = natural minor)
  - Spell with correct accidentals (one note letter per scale degree — no mixing ♯ and ♭ within a
    scale). Spot-check e.g. E♭ harmonic minor = E♭ F G♭ A♭ B♭ C♭ D.
- **Fingerings are static data**, not derived (no reliable formula). Keep `fingerings.ts` as a clear
  per-scale table keyed by tonic + scale type + hand (RH/LH). **Verify fingerings against a trusted
  reference** before committing them (the `/deep-research` skill is good for this).
- **Chords** (compute in `chords.ts`, don't hardcode): build by stacking diatonic thirds on the scale;
  derive quality from pitch-class intervals. Display as **symbols** — `C`, `Dm`, `B°`, `C+`, `Cmaj7`,
  `G7` (dom7), `Bø7` (half-dim), `B°7` (dim7). Major-key diatonic chords are unambiguous. **Minor keys
  use the common-practice set** (`i ii° III iv V VI vii°`): natural minor throughout, except **V** and
  **vii°** take the harmonic minor's raised leading tone (so V/V7 is dominant, vii°/vii°7 diminished).
  Spot-check e.g. A minor triads = `Am B° C Dm E F G♯°`. Verify any minor-key chord convention.

## SRS data model

- Each schedulable **item** is one atomic fact: a specific key relationship, a specific scale's notes,
  or a specific scale's fingering. Each item carries its own SM-2-lite state (ease, interval, due date,
  repetitions).
- **Persistence:** `localStorage` is the live store. An **Export** button serializes all SRS state to a
  downloadable JSON file; **Import** reads it back. The JSON schema is **versioned** (a `version` field)
  so older exports can be migrated forward.

## Design system ("Engraved")

The UI follows an antique music-engraving / editorial aesthetic — keep new UI
consistent with it. Tokens live in `src/index.css` under `@theme` (used as
Tailwind utilities like `bg-paper`, `text-ink`, `ring-rule`, `text-accent`):

- **Fonts:** `font-display` = Fraunces (wordmark, prompts, flourishes),
  `font-sans` = Hanken Grotesk (UI/body), `font-mono` = Spline Sans Mono
  (musical tokens, note names, finger numbers — has tabular figures). Loaded via
  Google Fonts in `index.html`.
- **Palette:** warm paper (`paper`/`card`) + warm `ink`; a single **claret**
  spot accent (`accent`); feedback as **viridian** (`correct`) / **vermilion**
  (`wrong`) ink. Hairlines/staff lines use `rule`. Don't introduce slate/indigo
  or new accent hues.
- **Details:** `.marking` = letterspaced small-caps eyebrow/label; `.staff-rule`
  = decorative 5-line staff; `.rise` / `.ink` = staggered entrance animations
  (respect `prefers-reduced-motion`). Completion screen closes on "Fine." (a
  fermata + the score-ending marking).

## Conventions

- TypeScript strict; functional components + hooks; Tailwind utility classes.
- Prefer computing music data over hardcoding it; add unit tests for `theory/` and `srs/` as they grow.
- **Touch support:** any hover-triggered feature must also work by tap, and a *definite/committing* action
  (answering, reset, import) must **select-then-confirm** on touch — first tap selects/previews, second
  tap confirms; mouse keeps single-click. Decide per interaction via `pointerType`, not device sniffing
  (`src/touch.ts`: `wasTouch()` / `useConfirmTap()`). New interactive UI should follow this.
- **Verify changes by driving the app with Playwright** (the default for "does it work in the browser?"):
  - **Regression:** run `npm run test:e2e` — the `tests/e2e/` smoke suite boots the dev server and
    proves a question renders, grades, and advances. Extend it when you add behavior worth locking in.
  - **Interactive / ad-hoc:** start `npm run dev`, then drive the running app with the **Playwright MCP**
    server (navigate to `http://localhost:5173`, snapshot/screenshot, click) to eyeball a change or
    script a one-off check.
  - Two gotchas when automating: some question categories are **sudden-death timed**, so answer via the
    keyboard (number keys `1–N` pick a choice, `Enter` advances) rather than slow clicks; and reset
    `localStorage` (key `music-theory-srs`) for a deterministic due queue.
