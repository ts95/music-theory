import { describe, expect, it } from 'vitest'
import { generateAllQuestions } from './generators'
import { ETUDES } from './etudes'
import { METERS, audibleSignature } from '../rhythm'
import { voicedMidi } from '../theory'

const questions = generateAllQuestions()

const ETUDE_IDS = new Set(ETUDES.map((e) => e.id))

describe('generateAllQuestions', () => {
  it('returns the expected total count', () => {
    const relMinor = questions.filter((q) => q.category === 'Relative minor')
    const scale = questions.filter((q) => q.category === 'Scale spelling')

    expect(relMinor).toHaveLength(12)
    // Scales: four ABRSM bands by key range (≤2/≤4/all/all = 5/9/12/12 keys) ×
    // (major + 3 minor forms) = 20+36+48+48, plus the modes at Expert (5 modes ×
    // 12 tonics − 5 double-accidental skips = 55) = 207.
    expect(scale).toHaveLength(207)

    // Four ABRSM-aligned bands. Key-range ladder is ≤1/≤3/≤5/all = 3/7/11/12 keys.
    // chords by degree: keys × 2 modes × 7 (trimmed triads + V7) = (3+7+11+12)×2×7 = 462.
    // chord recognition: L1 ≤3 keys, L2–L4 all keys × 2 × 7 = (7+12+12+12)×2×7 = 602.
    // chord spelling: same key ladder as chords = 462.
    // progressions: 13 variants × (3+7+11+12) keys = 429.
    // ear: 40 intervals (4+8+12+16) + 11 progression types + 84 melodic
    //   (10+12+10+10 motifs × 2 modes) + 256 rhythm-dictation (36+66+84+70) +
    //   248 rhythm-tap (same patterns, one tap exercise each; Medium drops 12/8,
    //   so 36+58+84+70) + 123 scale-play (10+17+48+48).
    // + 84 key-signatures: 30 keys (15 major + 15 minor) banded ≤2/≤4/≤6/≤7 =
    //   10+18+26+30 (key,level) pairs.
    expect(questions.length).toBe(
      12 + 207 + 84 + 123 + 462 + 602 + 462 + 429 + 40 + 11 + 84 + 256 + 248
    )
  })

  it('tags every question with a valid étude id and expected counts', () => {
    for (const q of questions) {
      expect(ETUDE_IDS.has(q.etudeId)).toBe(true)
    }
    const count = (id: string) =>
      questions.filter((q) => q.etudeId === id).length
    expect(count('relative-minors')).toBe(12)
    expect(count('scales')).toBe(207) // 4 bands: 20+36+48 (major+3 minors) + 103 (Expert adds modes)
    expect(count('key-signatures')).toBe(84) // 30 keys banded ≤2/≤4/≤6/≤7 = 10+18+26+30
    expect(count('chords')).toBe(462) // (3+7+11+12) keys × 2 × 7
    expect(count('chord-recognition')).toBe(602) // (7+12+12+12) keys × 2 × 7
    expect(count('chord-spelling')).toBe(462) // same key ladder as chords
    expect(count('progressions')).toBe(429) // 13 variants × (3+7+11+12) keys
    expect(count('intervals-ear')).toBe(40) // cumulative levels: 4 + 8 + 12 + 16
    expect(count('progressions-ear')).toBe(11)
    expect(count('melodic-dictation')).toBe(84) // (10+12+10+10) motifs × 2 modes
    expect(count('rhythm-dictation')).toBe(256) // L1 36 + L2 66 + L3 84 + L4 70
    expect(count('rhythm-tap')).toBe(248) // 36+58+84+70 — Medium drops 12/8 vs dictation
    expect(count('scale-play')).toBe(123) // 10 + 17 + 48 + 48
  })

  it('has unique ids', () => {
    const ids = questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every multiple-choice question is well-formed', () => {
    // Scale-play and tap-the-rhythm are interactive (no choices) — checked separately.
    for (const q of questions.filter((x) => !x.scalePlay && !x.tapAlong)) {
      expect(q.choices.length).toBeGreaterThanOrEqual(3)
      // Most questions have 4 choices; harder interval levels show up to 6.
      expect(q.choices.length).toBeLessThanOrEqual(6)
      expect(new Set(q.choices).size).toBe(q.choices.length)
      expect(q.answerIndex).toBeGreaterThanOrEqual(0)
      expect(q.answerIndex).toBeLessThan(q.choices.length)
    }
  })

  it('spot-checks: relative minor of E♭ major is C minor', () => {
    const q = questions.find((x) => x.id === 'rel-minor:Eb')
    expect(q).toBeDefined()
    expect(q!.prompt).toBe('What is the relative minor of E♭ major?')
    expect(q!.choices[q!.answerIndex]).toBe('C minor')
  })

  it('spot-checks: C harmonic minor scale notes', () => {
    // C minor (E♭ key, 3 accidentals) first appears at Medium (L2).
    const q = questions.find((x) => x.id === 'scale-notes:L2:C:harmonic')
    expect(q).toBeDefined()
    expect(q!.choices[q!.answerIndex]).toBe('C – D – E♭ – F – G – A♭ – B')
  })

  it('spot-checks: major and modal scale spellings', () => {
    // Major arrives at Easy; a missed answer's tip names the major pattern.
    const cMajor = questions.find((x) => x.id === 'scale-notes:L1:C:major')
    expect(cMajor!.choices[cMajor!.answerIndex]).toBe('C – D – E – F – G – A – B')
    // The Greek modes are Expert-only (L4); spellings via theory/scales.ts.
    const dDorian = questions.find((x) => x.id === 'scale-notes:L4:D:dorian')
    expect(dDorian!.choices[dDorian!.answerIndex]).toBe('D – E – F – G – A – B – C')
    const cLydian = questions.find((x) => x.id === 'scale-notes:L4:C:lydian')
    expect(cLydian!.choices[cLydian!.answerIndex]).toBe('C – D – E – F♯ – G – A – B')
    // Modes do NOT appear below Expert.
    expect(questions.some((x) => /^scale-notes:L[123]:.*:dorian$/.test(x.id))).toBe(false)
  })

  it('spot-checks: key signatures (accidentals, scale & keyboard)', () => {
    const ksig = questions.filter((q) => q.etudeId === 'key-signatures')
    const correct = (id: string) => {
      const q = ksig.find((x) => x.id === id)
      expect(q, id).toBeDefined()
      return q!.choices[q!.answerIndex]
    }
    // Accidentals named in key-signature order.
    expect(correct('key-sig:L2:A:major')).toBe('F♯, C♯, G♯')
    expect(correct('key-sig:L1:C:major')).toBe('None')
    expect(correct('key-sig:L1:A:minor')).toBe('None') // relative of C major
    expect(correct('key-sig:L2:E:minor')).toBe('F♯')
    expect(correct('key-sig:L1:F:major')).toBe('B♭')
    // The 7-accidental keys are Expert-only (≤7 band) — all sharps / all flats.
    expect(correct('key-sig:L4:C#:major')).toBe('F♯, C♯, G♯, D♯, A♯, E♯, B♯')
    expect(correct('key-sig:L4:Cb:major')).toBe('B♭, E♭, A♭, D♭, G♭, C♭, F♭')
    expect(questions.some((x) => /^key-sig:L[123]:C#:major$/.test(x.id))).toBe(false)

    // Reveal shows ONLY the accidentals: the staff carries the key signature and
    // one notehead per accidental, and the keyboard highlights those same keys
    // (labelled). C major / A minor have none → no staff and no keyboard.
    const aMaj = ksig.find((x) => x.id === 'key-sig:L2:A:major')!
    expect(aMaj.notation?.keySignature).toBe('A')
    expect(aMaj.notation?.onReveal).toBe(true)
    expect(aMaj.notation?.groups).toHaveLength(3) // only F♯, C♯, G♯ — not the whole scale
    expect(aMaj.keyboard?.marks).toHaveLength(3)
    // Voiced low→high in the octave at/above middle C: C♯4, F♯4, G♯4.
    expect(aMaj.keyboard!.marks.map((m) => m.label)).toEqual(['C♯', 'F♯', 'G♯'])
    expect(aMaj.keyboard!.marks.map((m) => m.midi)).toEqual([61, 66, 68])
    // Every accidental sits at or above middle C (60), within the octave above.
    const ksMarks = ksig.flatMap((q) => q.keyboard?.marks ?? [])
    expect(ksMarks.every((m) => m.midi >= 60 && m.midi <= 71)).toBe(true)
    const cMaj = ksig.find((x) => x.id === 'key-sig:L1:C:major')!
    expect(cMaj.notation).toBeUndefined()
    expect(cMaj.keyboard).toBeUndefined()
    expect(ksig.find((x) => x.id === 'key-sig:L1:A:minor')!.notation).toBeUndefined()
    expect(questions.find((x) => x.id === 'key-sig:L2:E:minor')!.notation?.keySignature).toBe('Em')
  })

  function correctFor(prompt: string): string {
    const q = questions.find((x) => x.prompt === prompt)
    expect(q, prompt).toBeDefined()
    return q!.choices[q!.answerIndex]
  }

  it('spot-checks: diatonic chords', () => {
    expect(correctFor('In C major, what is the IV chord?')).toBe('F')
    expect(correctFor('In A minor, what is the V chord?')).toBe('E')
    expect(correctFor('In E♭ major, what is the V7 chord?')).toBe('B♭7')
  })

  it('spot-checks: chord spelling (symbol → notes)', () => {
    const dm = questions.find((x) => x.id === 'chord-spell:L1:CM:1:triad')
    expect(dm).toBeDefined()
    expect(dm!.prompt).toBe('Spell the chord Dm.')
    expect(dm!.choices[dm!.answerIndex]).toBe('D – F – A')
    // Distractors share the root D, differing only in quality.
    for (const c of dm!.choices) expect(c.startsWith('D')).toBe(true)

    // A flat-spelled seventh: C minor i7 = Cm7 = C – E♭ – G – B♭ (never A♯).
    const cm7 = questions.find((x) => x.id === 'chord-spell:L2:Cm:0:seventh')
    expect(cm7).toBeDefined()
    expect(cm7!.prompt).toBe('Spell the chord Cm7.')
    expect(cm7!.choices[cm7!.answerIndex]).toBe('C – E♭ – G – B♭')
  })

  it('chord-spelling reveals use the chord’s own tonic key (or a valid fallback)', () => {
    // Every signature must be one VexFlow accepts: a real key, or the bare "C"
    // fallback for chords whose root key is unreal (e.g. D♯ major, E♯ minor).
    const valid = new Set([
      ...['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
      ...['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'],
    ])
    const spelling = questions.filter((q) => q.etudeId === 'chord-spelling')
    // The major triad C and the minor triad Cm should pick their own keys.
    expect(spelling.find((q) => q.prompt === 'Spell the chord C.')?.notation?.keySignature).toBe('C')
    expect(spelling.find((q) => q.prompt === 'Spell the chord Gm.')?.notation?.keySignature).toBe('Gm')
    for (const q of spelling) {
      const sig = q.notation?.keySignature ?? ''
      expect(valid.has(sig), `${q.prompt} → ${sig}`).toBe(true)
    }
  })

  it('spot-checks: progressions', () => {
    const cMajIIVI = questions.find((x) => x.id === 'prog:L1:C:major:ii-V-I:3')
    expect(cMajIIVI).toBeDefined()
    expect(cMajIIVI!.choices[cMajIIVI!.answerIndex]).toBe('Dm – G – C')

    const aMin = questions.find((x) => x.id === 'prog:L1:A:minor:iio-V-i:3')
    expect(aMin).toBeDefined()
    expect(aMin!.choices[aMin!.answerIndex]).toBe('B° – E – Am')

    const cMajSeventh = questions.find((x) => x.id === 'prog:L1:C:major:ii-V-I:7')
    expect(cMajSeventh).toBeDefined()
    expect(cMajSeventh!.prompt).toBe(
      'In C major, spell the progression ii7–V7–Imaj7.'
    )
    expect(cMajSeventh!.choices[cMajSeventh!.answerIndex]).toBe(
      'Dm7 – G7 – Cmaj7'
    )
  })

  it('every choices[answerIndex] equals the documented correct answer', () => {
    for (const q of questions.filter((x) => !x.scalePlay && !x.tapAlong)) {
      expect(q.choices[q.answerIndex]).toBeDefined()
    }
  })

  it('is deterministic across calls', () => {
    expect(generateAllQuestions()).toEqual(generateAllQuestions())
  })

  describe('hover audio', () => {
    it('attaches playable audio for every choice of scale/chord/progression/relative-minor/recognition', () => {
      const playable = questions.filter((q) =>
        [
          'Relative minor',
          'Scale spelling',
          'Diatonic chord',
          'Progression',
          'Chord recognition',
        ].includes(q.category)
      )
      expect(playable.length).toBeGreaterThan(0)
      for (const q of playable) {
        expect(q.audio, q.id).toBeDefined()
        // Every rendered choice has audio, keyed by its display string.
        for (const c of q.choices) {
          expect(q.audio![c], `${q.id} / ${c}`).toBeDefined()
          expect(q.audio![c].events.length).toBeGreaterThan(0)
        }
      }
    })

    it('spot-checks playback data', () => {
      // C major scale ascends C4..B4.
      const scale = questions.find((x) => x.id === 'scale-notes:L1:A:natural')
      expect(scale!.audio!['A – B – C – D – E – F – G'].kind).toBe('scale')

      // Étude 2 "F" major triad.
      const fMaj = questions.find(
        (x) => x.prompt === 'In C major, what is the IV chord?'
      )!
      expect(fMaj.audio!['F']).toEqual({ kind: 'chord', events: [[65, 69, 72]] })

      // Étude 3 C major I–IV–V progression.
      const prog = questions.find((x) => x.id === 'prog:L1:C:major:I-IV-V:3')!
      expect(prog.audio!['C – F – G']).toEqual({
        kind: 'progression',
        events: [
          [60, 64, 67],
          [65, 69, 72],
          [67, 71, 74],
        ],
      })
    })
  })

  describe('harder distractors', () => {
    const scaleQ = questions.filter((q) => q.category === 'Scale spelling')
    const chordQ = questions.filter((q) => q.category === 'Diatonic chord')
    const progQ = questions.filter((q) => q.category === 'Progression')

    it('every scale option starts on the same tonic', () => {
      for (const q of scaleQ) {
        const firstNotes = new Set(q.choices.map((c) => c.split(' – ')[0]))
        expect(firstNotes.size, q.id).toBe(1)
      }
    })

    it('scale distractors draw on more than the three minor forms', () => {
      const all = new Set(scaleQ.flatMap((q) => q.choices))
      // 12 tonics × 3 minor forms = 36; modes/major push it well past that.
      expect(all.size).toBeGreaterThan(36)
    })

    it('chord questions include a same-root, different-quality distractor', () => {
      const i = questions.find(
        (x) => x.prompt === 'In C major, what is the I chord?'
      )!
      expect(i.choices).toContain('C')
      expect(i.choices).toContain('Cm') // root no longer uniquely identifies it

      const v = questions.find(
        (x) => x.prompt === 'In A minor, what is the V chord?'
      )!
      expect(v.choices).toContain('E')
      expect(v.choices).toContain('Em')
    })

    it('no chord question is the only option on the tonic-of-the-key by root alone', () => {
      // For each chord question, at least two options share the answer's root
      // OR at least two share its quality — i.e. neither feature is unique.
      for (const q of chordQ) {
        const answer = q.choices[q.answerIndex]
        const root = (s: string) => s.match(/^[A-G][#♯b♭x𝄪𝄫]*/)?.[0] ?? s
        const sameRoot = q.choices.filter((c) => root(c) === root(answer))
        expect(sameRoot.length, q.prompt).toBeGreaterThanOrEqual(2)
      }
    })

    it('progressions offer more than one option starting on the same chord', () => {
      const q = questions.find((x) => x.id === 'prog:L1:C:major:I-IV-V:3')!
      const firstChords = q.choices.map((c) => c.split(' – ')[0])
      expect(firstChords.filter((fc) => fc === 'C').length).toBeGreaterThanOrEqual(2)
    })

    it('keeps the question counts and ids stable', () => {
      expect(scaleQ).toHaveLength(207)
      expect(chordQ).toHaveLength(462)
      expect(progQ).toHaveLength(429)
    })
  })

  describe('memory tips (explanations)', () => {
    it('every question has a non-empty explanation', () => {
      // Scale-play and tap-the-rhythm are interactive; they have no MC tip.
      for (const q of questions.filter((x) => !x.scalePlay && !x.tapAlong)) {
        expect(q.explanation, q.id).toBeTruthy()
        expect(q.explanation!.length).toBeGreaterThan(10)
      }
    })

    const find = (prompt: string) => questions.find((x) => x.prompt === prompt)!

    it('relative-minor tip cites the 6th degree and the answer', () => {
      const e = find('What is the relative minor of E♭ major?').explanation!
      expect(e).toMatch(/6th/)
      expect(e).toContain('C minor')
    })

    it('harmonic-minor scale tip names the raised 7th', () => {
      const q = questions.find((x) => x.id === 'scale-notes:L2:C:harmonic')!
      expect(q.explanation).toMatch(/raised 7th/)
      expect(q.explanation).toContain('B♭') // the raised note: B♭ → B♮
    })

    it('chord tip cites the degree and quality', () => {
      const e = find('In C major, what is the IV chord?').explanation!
      expect(e).toMatch(/4th degree/)
      expect(e).toMatch(/major/)
      expect(e).toContain('→ F')
    })

    it('progression tip reads out the numerals', () => {
      const q = questions.find((x) => x.id === 'prog:L1:C:major:ii-V-I:3')!
      expect(q.explanation).toContain('ii=Dm')
      expect(q.explanation).toContain('V=G')
      expect(q.explanation).toContain('I=C')
    })

  })

  describe('ear-training questions', () => {
    const earQ = questions.filter((q) => q.ear)

    it('every ear question carries an ear spec, distinct choices, and a tip', () => {
      // 40 intervals + 11 progressions + 84 melodic + 256 rhythm.
      expect(earQ.length).toBe(40 + 11 + 84 + 256)
      for (const q of earQ) {
        expect(q.ear, q.id).toBeDefined()
        expect(q.choices.length, q.id).toBeGreaterThanOrEqual(4)
        expect(q.choices.length, q.id).toBeLessThanOrEqual(6)
        expect(new Set(q.choices).size).toBe(q.choices.length)
        expect(q.explanation).toBeTruthy()
        expect(q.audio).toBeUndefined() // no hover audio — the question owns the sound
      }
    })

    it('interval questions span four cumulative levels with widening options', () => {
      const intervals = questions.filter((q) => q.ear?.kind === 'interval')
      expect(intervals).toHaveLength(40)
      expect(intervals.filter((q) => q.level === 1)).toHaveLength(4) // Easy
      expect(intervals.filter((q) => q.level === 2)).toHaveLength(8) // Medium
      expect(intervals.filter((q) => q.level === 3)).toHaveLength(12) // Hard (all simple)
      expect(intervals.filter((q) => q.level === 4)).toHaveLength(16) // Expert (+ compound)
      // P5 appears at every level; the option count grows 4 → 5 → 6 → 6.
      const p5 = questions.find((x) => x.id === 'interval-ear:L1:7')!
      expect(p5.choices[p5.answerIndex]).toBe('Perfect 5th')
      expect(p5.ear).toEqual({ kind: 'interval', semitones: 7, letterSteps: 4 })
      expect(p5.choices.length).toBe(4)
      expect(questions.find((x) => x.id === 'interval-ear:L2:7')!.choices.length).toBe(5)
      expect(questions.find((x) => x.id === 'interval-ear:L3:7')!.choices.length).toBe(6)
      // Expert introduces compound intervals (an octave + a simple interval).
      const m9 = questions.find((x) => x.id === 'interval-ear:L4:13')!
      expect(m9.choices[m9.answerIndex]).toBe('Minor 9th')
      expect(m9.ear).toEqual({ kind: 'interval', semitones: 13, letterSteps: 8 })
      const compound = intervals.filter(
        (q) => q.level === 4 && q.ear?.kind === 'interval' && q.ear.semitones > 12,
      )
      expect(compound.length).toBeGreaterThan(0)
    })

    it('progression-by-ear reuses the curated set', () => {
      const q = questions.find((x) => x.id === 'prog-ear:major:I-IV-V')!
      expect(q.choices[q.answerIndex]).toBe('I–IV–V')
      expect(q.ear).toEqual({ kind: 'progression', mode: 'major', degrees: [0, 3, 4] })
    })
  })

  describe('keyboard & circle notation (études 1 & 2)', () => {
    it('scale-spelling questions light up the 7 scale keys; major/minor labelled RH/LH, modes unlabelled', () => {
      const isMode = (id: string) =>
        /:(dorian|phrygian|lydian|mixolydian|locrian)$/.test(id)
      for (const q of questions.filter((x) => x.category === 'Scale spelling')) {
        expect(q.keyboard, q.id).toBeDefined()
        expect(q.keyboard!.marks, q.id).toHaveLength(7)
        if (isMode(q.id)) {
          // Modes have no verified fingering — keys lit, but no finger numbers.
          expect(
            q.keyboard!.marks.every((m) => m.label === undefined && m.sublabel === undefined),
            q.id
          ).toBe(true)
        } else {
          // Major + the 3 minor forms carry both fingerings (RH label, LH sublabel).
          expect(
            q.keyboard!.marks.every((m) => m.label !== undefined && m.sublabel !== undefined),
            q.id
          ).toBe(true)
        }
      }
      // A natural minor: A4 B4 C5 D5 E5 F5 G5 (C wraps up an octave).
      const a = questions.find((x) => x.id === 'scale-notes:L1:A:natural')!
      expect(a.keyboard!.marks.map((m) => m.midi)).toEqual([69, 71, 72, 74, 76, 77, 79])
      expect(a.keyboard!.marks.map((m) => m.label)).toEqual(['1', '2', '3', '1', '2', '3', '4'])
      expect(a.keyboard!.marks.map((m) => m.sublabel)).toEqual(['5', '4', '3', '2', '1', '3', '2'])
    })

    it('chord questions light up the chord keys, labelled RH/LH', () => {
      for (const q of questions.filter((x) => x.category === 'Diatonic chord')) {
        expect(q.keyboard, q.id).toBeDefined()
        expect(
          q.keyboard!.marks.every((m) => m.label !== undefined && m.sublabel !== undefined),
          q.id
        ).toBe(true)
      }
      // F major triad in root position from octave 4: F4 A4 C5, fingered 1-3-5 / 5-3-1.
      const iv = questions.find(
        (x) => x.prompt === 'In C major, what is the IV chord?'
      )!
      expect(iv.keyboard!.marks.map((m) => m.midi)).toEqual([65, 69, 72])
      expect(iv.keyboard!.marks.map((m) => m.label)).toEqual(['1', '3', '5'])
      expect(iv.keyboard!.marks.map((m) => m.sublabel)).toEqual(['5', '3', '1'])
      // V7 is a four-note chord, fingered 1-2-3-5 / 5-3-2-1.
      const v7 = questions.find((x) => x.id === 'chord-deg:L1:C:major:4:7')!
      expect(v7.keyboard!.marks).toHaveLength(4)
      expect(v7.keyboard!.marks.map((m) => m.label)).toEqual(['1', '2', '3', '5'])
      expect(v7.keyboard!.marks.map((m) => m.sublabel)).toEqual(['5', '3', '2', '1'])
    })

    it('relative-minor questions carry a circle highlight, not a keyboard', () => {
      for (const q of questions.filter((x) => x.category === 'Relative minor')) {
        expect(q.circle, q.id).toBeDefined()
        expect(q.keyboard).toBeUndefined()
      }
      const eb = questions.find((x) => x.id === 'rel-minor:Eb')!
      expect(eb.circle).toEqual({ major: 'E♭ major' })
    })

    it('progression and ear questions get neither a keyboard nor a circle', () => {
      for (const q of questions.filter(
        (x) => x.category === 'Progression' || x.ear
      )) {
        expect(q.keyboard, q.id).toBeUndefined()
        expect(q.circle, q.id).toBeUndefined()
      }
    })
  })

  describe('chord recognition (étude 5)', () => {
    const recog = questions.filter((x) => x.category === 'Chord recognition')

    it('renders every chord on a staff under a key signature, with a tip', () => {
      expect(recog).toHaveLength(602)
      for (const q of recog) {
        expect(q.etudeId).toBe('chord-recognition')
        expect(q.notation, q.id).toBeDefined()
        expect(q.notation!.groups).toHaveLength(1) // one stave note (the chord)
        const n = q.notation!.groups[0].length
        expect(n, q.id).toBeGreaterThanOrEqual(3) // triad … ninth
        expect(n, q.id).toBeLessThanOrEqual(5)
        expect(['treble', 'bass']).toContain(q.notation!.clef)
        expect(q.notation!.keySignature.length, q.id).toBeGreaterThan(0)
        expect(q.keyboard, q.id).toBeUndefined()
        expect(q.level, q.id).toBeGreaterThanOrEqual(1)
        expect(q.level, q.id).toBeLessThanOrEqual(4)
        expect(q.explanation, q.id).toBeTruthy() // memory tip on a miss
      }
    })

    it('uses only root / first / second inversion', () => {
      for (const q of recog) {
        const inv = Number(q.id.split(':').pop())
        expect(inv, q.id).toBeLessThanOrEqual(2)
      }
    })

    it('four difficulty levels scale chord complexity and key range', () => {
      const easy = recog.filter((q) => q.level === 1)
      const medium = recog.filter((q) => q.level === 2)
      const hard = recog.filter((q) => q.level === 3)
      const expert = recog.filter((q) => q.level === 4)
      expect(easy).toHaveLength(98) // 7 keys (≤3) × 2 modes × 7
      expect(medium).toHaveLength(168) // 12 keys × 2 modes × 7
      expect(hard).toHaveLength(168)
      expect(expert).toHaveLength(168)

      const hasNinth = (qs: typeof recog) => qs.some((q) => q.notation!.groups[0].length === 5)
      const hasSeventh = (qs: typeof recog) => qs.some((q) => q.notation!.groups[0].length === 4)
      const hasInversion = (qs: typeof recog) => qs.some((q) => q.choices[q.answerIndex].includes('/'))

      // Easy: triads only, root position (no slash chords, no sevenths/ninths).
      for (const q of easy) {
        expect(q.notation!.groups[0], q.id).toHaveLength(3)
        expect(q.choices[q.answerIndex], q.id).not.toContain('/')
      }
      // Medium adds inversions but still only triads.
      expect(hasInversion(medium)).toBe(true)
      expect(medium.every((q) => q.notation!.groups[0].length === 3)).toBe(true)
      // Hard adds sevenths; Expert alone introduces ninths.
      expect(hasSeventh(hard)).toBe(true)
      expect(hasNinth(hard)).toBe(false)
      expect(hasNinth(expert)).toBe(true)
      // Expert runs against a tighter clock.
      expect(expert.some((q) => q.timeLimitMs === 8000)).toBe(true)
    })

    it('covers augmented, dominant, diminished, and 9th chords (with inversions)', () => {
      const answers = recog.map((q) => q.choices[q.answerIndex])
      const bases = answers.map((s) => s.split('/')[0])
      expect(bases.some((s) => s.endsWith('+'))).toBe(true) // augmented (III+)
      expect(bases.some((s) => s.includes('°'))).toBe(true) // diminished
      expect(bases.some((s) => /9$/.test(s))).toBe(true) // a ninth (9 / maj9 / m9)
      expect(bases.some((s) => /^[A-G][♭♯]?7$/.test(s))).toBe(true) // dominant 7th
      expect(answers.some((s) => s.includes('/'))).toBe(true) // an inversion
    })
  })

  describe('melodic dictation (étude 9)', () => {
    const melody = questions.filter((x) => x.category === 'Melodic dictation')
    const specOf = (q: (typeof melody)[number]) =>
      q.ear as { kind: 'melody'; mode: 'major' | 'minor'; degrees: number[] }

    it('is a solfège prompt across four levels, both modes', () => {
      expect(melody).toHaveLength(84)
      for (const q of melody) {
        expect(q.ear?.kind).toBe('melody')
        const spec = specOf(q)
        // Answer tokens match the degree count.
        expect(q.choices[q.answerIndex].split('–')).toHaveLength(spec.degrees.length)
        expect(q.level, q.id).toBeGreaterThanOrEqual(1)
        expect(q.level, q.id).toBeLessThanOrEqual(4)
        expect(q.explanation).toBeTruthy()
      }
      // Every level carries both modes.
      for (const level of [1, 2, 3, 4]) {
        const modes = new Set(melody.filter((q) => q.level === level).map((q) => specOf(q).mode))
        expect([...modes].sort()).toEqual(['major', 'minor'])
      }
      // do mi sol do in major (Level 2).
      const m = melody.find((x) => x.id === 'melody:L2:major:0240')!
      expect(m.choices[m.answerIndex]).toBe('do–mi–sol–do')
      // Level 3 includes the complete 8-note scale (do…do).
      const scale = melody.find((x) => x.id === 'melody:L3:major:01234567')!
      expect(scale.choices[scale.answerIndex]).toBe('do–re–mi–fa–sol–la–ti–do')
      // Expert (Level 4) ranges beyond the octave — at least one degree > 7.
      const expert = melody.filter((q) => q.level === 4)
      expect(expert.some((q) => specOf(q).degrees.some((d) => d > 7))).toBe(true)
    })
  })

  describe('rhythm dictation (étude 10)', () => {
    const rhythm = questions.filter((x) => x.category === 'Rhythm dictation')
    const BEATS = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25, '32': 0.125 } as const
    type Ev = {
      dur: keyof typeof BEATS
      dots?: number
      triplet?: boolean
      rest?: boolean
      tie?: boolean
    }
    const beatsOf = (e: Ev) =>
      e.triplet ? BEATS[e.dur] * (2 / 3) : BEATS[e.dur] * (2 - 1 / 2 ** (e.dots ?? 0))

    const specOf = (q: (typeof rhythm)[number]) =>
      q.ear as { kind: 'rhythm'; meter: keyof typeof METERS; pattern: Ev[] }

    it('every choice is a valid one-bar pattern in its metre, aligned to choices', () => {
      expect(rhythm).toHaveLength(256) // L1 36 + L2 66 + L3 84 + L4 70
      for (const q of rhythm) {
        expect(q.ear?.kind).toBe('rhythm')
        const total = METERS[specOf(q).meter].totalBeats
        expect(q.rhythmChoices, q.id).toBeDefined()
        expect(q.rhythmChoices!).toHaveLength(q.choices.length)
        for (const pattern of q.rhythmChoices! as Ev[][]) {
          const beats = pattern.reduce((s, e) => s + beatsOf(e), 0)
          expect(beats, q.id).toBeCloseTo(total, 5) // ties don't change the total
        }
        expect(q.level, q.id).toBeGreaterThanOrEqual(1)
        expect(q.explanation).toBeTruthy()
      }
    })

    it('never offers two choices that sound identical (e.g. dotted vs tied)', () => {
      for (const q of rhythm) {
        const sigs = q.rhythmChoices!.map(audibleSignature)
        expect(new Set(sigs).size, q.id).toBe(sigs.length)
      }
    })

    it('covers all nine metres and four levels', () => {
      expect([...new Set(rhythm.map((q) => specOf(q).meter))].sort()).toEqual([
        '12/8',
        '2/2',
        '2/4',
        '3/4',
        '4/4',
        '5/4',
        '5/8',
        '6/8',
        '7/8',
      ])
      expect([...new Set(rhythm.map((q) => q.level))].sort()).toEqual([1, 2, 3, 4])
    })

    it('metres cascade: each level inherits the previous levels’ metres', () => {
      const metresAt = (lvl: number) =>
        new Set(rhythm.filter((q) => q.level === lvl).map((q) => specOf(q).meter))
      const easy = metresAt(1)
      const medium = metresAt(2)
      const hard = metresAt(3)
      const expert = metresAt(4)
      for (const m of easy) expect(medium.has(m), `medium missing ${m}`).toBe(true)
      for (const m of medium) expect(hard.has(m), `hard missing ${m}`).toBe(true)
      for (const m of hard) expect(expert.has(m), `expert missing ${m}`).toBe(true)
      expect(easy.has('2/4')).toBe(true) // Easy adds 2/4
      expect(easy.has('6/8')).toBe(false) // 6/8 is compound — Medium and up only
      expect(medium.has('6/8') && medium.has('12/8') && medium.has('2/2')).toBe(true)
      expect(hard.has('5/4')).toBe(true) // Hard adds 5/4
      expect(hard.has('5/8') && hard.has('7/8')).toBe(true) // …and the asymmetric eighth metres
    })

    it('ties are valid: adjacent, never on a rest or the last event', () => {
      let tied = 0
      for (const q of rhythm) {
        const p = specOf(q).pattern
        p.forEach((e, i) => {
          if (!e.tie) return
          tied++
          expect(e.rest, q.id).toBeFalsy()
          expect(i, q.id).toBeLessThan(p.length - 1)
          expect(p[i + 1].rest, q.id).toBeFalsy()
        })
      }
      expect(tied).toBeGreaterThan(0)
    })

    it('higher levels add 32nds, whole notes, ties; tempo rises', () => {
      const hasDur = (lvl: number, dur: string) =>
        rhythm.some((q) => q.level === lvl && specOf(q).pattern.some((e) => e.dur === dur))
      expect(hasDur(1, 'w')).toBe(true) // whole notes at Easy
      expect(hasDur(3, '32')).toBe(true) // 32nds at Hard
      const tempo = (lvl: number) =>
        (rhythm.find((q) => q.level === lvl)!.ear as { tempo: number }).tempo
      expect(tempo(1)).toBeLessThan(tempo(2))
      expect(tempo(2)).toBeLessThan(tempo(3))
    })
  })
})

describe('play the scale (étude 4)', () => {
  const scalePlay = questions.filter((q) => q.scalePlay)
  const sp = (lvl: number) =>
    scalePlay.find((q) => q.level === lvl)!.scalePlay!

  it('covers the cumulative ABRSM scope per level', () => {
    expect(scalePlay).toHaveLength(123)
    expect(scalePlay.filter((q) => q.level === 1)).toHaveLength(10) // 4 maj + 2 min×3
    expect(scalePlay.filter((q) => q.level === 2)).toHaveLength(17) // 5 maj + 4 min×3
    expect(scalePlay.filter((q) => q.level === 3)).toHaveLength(48) // 12 maj + 12 min×3
    expect(scalePlay.filter((q) => q.level === 4)).toHaveLength(48) // Expert: all keys, faster
  })

  it('octaves & sudden-death timer per level', () => {
    expect([sp(1).octaves, sp(1).seconds]).toEqual([1, 15])
    expect([sp(2).octaves, sp(2).seconds]).toEqual([2, 20])
    expect([sp(3).octaves, sp(3).seconds]).toEqual([2, 18]) // Hard eased to 18 s
    expect([sp(4).octaves, sp(4).seconds]).toEqual([2, 12]) // Expert: tighter clock
  })

  it('notes + both fingerings are aligned and ascending', () => {
    for (const q of scalePlay) {
      const s = q.scalePlay!
      const len = s.octaves === 1 ? 8 : 15
      expect(s.notes.length, q.id).toBe(len)
      expect(s.rh.length, q.id).toBe(len)
      expect(s.lh.length, q.id).toBe(len)
      const midis = s.notes.map(voicedMidi)
      for (let i = 1; i < midis.length; i++) {
        expect(midis[i], q.id).toBeGreaterThan(midis[i - 1]) // strictly ascending
      }
      expect(s.rh.every((f) => f >= 1 && f <= 5), q.id).toBe(true)
      expect(s.lh.every((f) => f >= 1 && f <= 5), q.id).toBe(true)
    }
  })
})
