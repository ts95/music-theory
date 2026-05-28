# Music Theory

A personal, custom-built music-theory tutor — a React web app for teaching myself music theory through
tailored, interactive exercises. Built with [Claude Code](https://claude.com/claude-code).

It's a single-user tool with no backend and no accounts. Everything runs in the browser; progress is
stored locally and can be exported to a file.

## Features

**Now**
- 🎹 **Spaced-repetition exercise: keys & relative minors.** Multiple-choice drills that adapt to what
  you remember:
  - Relative minors of the major keys ("What is the relative minor of E♭ major?")
  - Scale spellings — natural, harmonic, and melodic minor ("What are the notes of E♭ harmonic minor?")
  - Standard **piano** fingerings (RH/LH) for the scales
- 💾 **Progress that's yours.** Saved to your browser, with JSON **export/import** to back up or move
  between devices.

**Roadmap (ideas, not commitments)**
- 🔊 Audio playback of scales/intervals (Tone.js)
- 🎼 Staff notation for questions and answers (VexFlow)
- 📚 More topics: intervals, chords, modes, progressions, ear training

## Tech stack

Vite · React · TypeScript · Tailwind CSS · Tone.js (audio) · VexFlow (notation)

## Getting started

Prerequisites: **Node.js 20+**.

```bash
npm install      # install dependencies
npm run dev      # start the dev server, then open the printed localhost URL
```

Other commands:

```bash
npm run build    # production build
npm run preview  # preview the production build locally
```

## How it works

The exercise uses **spaced repetition** (an SM-2-style scheduler): each fact you study — a key
relationship, a scale's notes, a fingering — is tracked individually. Answer well and you'll see it less
often; struggle and it comes back sooner.

**Backup & sync:** your progress lives in the browser's `localStorage`. Use **Export** to download a
JSON snapshot, and **Import** to restore it (handy for a new browser or device). Export files are
versioned so they keep working as the app evolves.

## Project structure

```
src/
├── theory/      # Pure music-theory domain: notes, keys, scales, fingerings
├── srs/         # Spaced-repetition scheduler + localStorage / JSON persistence
├── questions/   # Builds multiple-choice questions from the theory data
└── components/  # React UI (review session, question cards, …)
```

See [CLAUDE.md](./CLAUDE.md) for the architecture, conventions, and working principles used when
developing this project.

## Status

Early and evolving — built incrementally to fit how I actually want to learn.
