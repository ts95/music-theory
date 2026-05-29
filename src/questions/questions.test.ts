import { describe, expect, it } from 'vitest'
import { generateAllQuestions } from './generators'
import { ETUDES } from './etudes'
import { KEYS, fingering } from '../theory'

const questions = generateAllQuestions()

const ETUDE_IDS = new Set(ETUDES.map((e) => e.id))

function countNonNullFingerings(): number {
  let n = 0
  for (const key of KEYS) {
    for (const hand of ['RH', 'LH'] as const) {
      if (fingering(key.minorTonic, 'natural', hand)) n++
    }
  }
  return n
}

describe('generateAllQuestions', () => {
  it('returns the expected total count', () => {
    const fingeringCount = countNonNullFingerings()
    const relMinor = questions.filter((q) => q.category === 'Relative minor')
    const scale = questions.filter((q) => q.category === 'Scale spelling')
    const fing = questions.filter((q) => q.category === 'Fingering')

    expect(relMinor).toHaveLength(12)
    expect(scale).toHaveLength(36)
    expect(fing).toHaveLength(fingeringCount) // 24

    // chords by degree: 24 key/mode combos × 7 (trimmed triads + V7) = 168.
    // chord recognition: 3 levels by key range × 2 modes × 7 degrees
    //   = (3 + 7 + 12 keys) × 2 × 7 = 42 + 98 + 168 = 308.
    // progressions: 6 major + 5 minor triad progressions × 12 keys = 132,
    // plus 2 idiomatic seventh forms × 12 = 24, total 156.
    // ear: 12 intervals + 11 progression types + 24 melodic (12 motifs × 2 modes)
    //   + 18 rhythm patterns.
    expect(questions.length).toBe(
      12 + 36 + fingeringCount + 168 + 308 + 156 + 12 + 11 + 24 + 18
    )
  })

  it('tags every question with a valid étude id and expected counts', () => {
    for (const q of questions) {
      expect(ETUDE_IDS.has(q.etudeId)).toBe(true)
    }
    const count = (id: string) =>
      questions.filter((q) => q.etudeId === id).length
    expect(count('relative-minors')).toBe(12)
    expect(count('scales')).toBe(36)
    expect(count('fingerings')).toBe(24)
    expect(count('chords')).toBe(168)
    expect(count('chord-recognition')).toBe(308)
    expect(count('progressions')).toBe(156)
    expect(count('intervals-ear')).toBe(12)
    expect(count('progressions-ear')).toBe(11)
    expect(count('melodic-dictation')).toBe(24)
    expect(count('rhythm-dictation')).toBe(18)
  })

  it('has unique ids', () => {
    const ids = questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every question is well-formed', () => {
    for (const q of questions) {
      expect(q.choices.length).toBeGreaterThanOrEqual(3)
      expect(q.choices.length).toBeLessThanOrEqual(4)
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
    const q = questions.find((x) => x.id === 'scale-notes:C:harmonic')
    expect(q).toBeDefined()
    expect(q!.choices[q!.answerIndex]).toBe('C – D – E♭ – F – G – A♭ – B')
  })

  it('spot-checks: A minor right-hand fingering', () => {
    const q = questions.find((x) => x.id === 'fingering:A:RH')
    expect(q).toBeDefined()
    expect(q!.choices[q!.answerIndex]).toBe('1 2 3 1 2 3 4 1 2 3 1 2 3 4 5')
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

  it('spot-checks: progressions', () => {
    const cMajIIVI = questions.find((x) => x.id === 'prog:C:major:ii-V-I:3')
    expect(cMajIIVI).toBeDefined()
    expect(cMajIIVI!.choices[cMajIIVI!.answerIndex]).toBe('Dm – G – C')

    const aMin = questions.find((x) => x.id === 'prog:A:minor:iio-V-i:3')
    expect(aMin).toBeDefined()
    expect(aMin!.choices[aMin!.answerIndex]).toBe('B° – E – Am')

    const cMajSeventh = questions.find((x) => x.id === 'prog:C:major:ii-V-I:7')
    expect(cMajSeventh).toBeDefined()
    expect(cMajSeventh!.prompt).toBe(
      'In C major, spell the progression ii7–V7–Imaj7.'
    )
    expect(cMajSeventh!.choices[cMajSeventh!.answerIndex]).toBe(
      'Dm7 – G7 – Cmaj7'
    )
  })

  it('every choices[answerIndex] equals the documented correct answer', () => {
    for (const q of questions) {
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

    it('attaches no audio to fingering questions', () => {
      for (const q of questions.filter((x) => x.category === 'Fingering')) {
        expect(q.audio).toBeUndefined()
      }
    })

    it('spot-checks playback data', () => {
      // C major scale ascends C4..B4.
      const scale = questions.find((x) => x.id === 'scale-notes:A:natural')
      expect(scale!.audio!['A – B – C – D – E – F – G'].kind).toBe('scale')

      // Étude 2 "F" major triad.
      const fMaj = questions.find(
        (x) => x.prompt === 'In C major, what is the IV chord?'
      )!
      expect(fMaj.audio!['F']).toEqual({ kind: 'chord', events: [[65, 69, 72]] })

      // Étude 3 C major I–IV–V progression.
      const prog = questions.find((x) => x.id === 'prog:C:major:I-IV-V:3')!
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
      const q = questions.find((x) => x.id === 'prog:C:major:I-IV-V:3')!
      const firstChords = q.choices.map((c) => c.split(' – ')[0])
      expect(firstChords.filter((fc) => fc === 'C').length).toBeGreaterThanOrEqual(2)
    })

    it('keeps the question counts and ids stable', () => {
      expect(scaleQ).toHaveLength(36)
      expect(chordQ).toHaveLength(168)
      expect(progQ).toHaveLength(156)
    })
  })

  describe('memory tips (explanations)', () => {
    it('every question has a non-empty explanation', () => {
      for (const q of questions) {
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
      const q = questions.find((x) => x.id === 'scale-notes:C:harmonic')!
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
      const q = questions.find((x) => x.id === 'prog:C:major:ii-V-I:3')!
      expect(q.explanation).toContain('ii=Dm')
      expect(q.explanation).toContain('V=G')
      expect(q.explanation).toContain('I=C')
    })

    it('fingering tip states the thumb rule', () => {
      const q = questions.find((x) => x.id === 'fingering:A:RH')!
      expect(q.explanation).toMatch(/thumb/)
    })
  })

  describe('ear-training questions', () => {
    const earQ = questions.filter((q) => q.ear)

    it('every ear question carries an ear spec, 4 choices, and a tip', () => {
      // 12 intervals + 11 progressions + 24 melodic + 18 rhythm.
      expect(earQ.length).toBe(12 + 11 + 24 + 18)
      for (const q of earQ) {
        expect(q.ear, q.id).toBeDefined()
        expect(q.choices.length).toBe(4)
        expect(new Set(q.choices).size).toBe(4)
        expect(q.explanation).toBeTruthy()
        expect(q.audio).toBeUndefined() // no hover audio — the question owns the sound
      }
    })

    it('interval questions cover all 12 intervals with correct specs', () => {
      const intervals = questions.filter((q) => q.ear?.kind === 'interval')
      expect(intervals).toHaveLength(12)
      const p5 = questions.find((x) => x.id === 'interval-ear:7')!
      expect(p5.choices[p5.answerIndex]).toBe('Perfect 5th')
      expect(p5.ear).toEqual({ kind: 'interval', semitones: 7, letterSteps: 4 })
    })

    it('progression-by-ear reuses the curated set', () => {
      const q = questions.find((x) => x.id === 'prog-ear:major:I-IV-V')!
      expect(q.choices[q.answerIndex]).toBe('I–IV–V')
      expect(q.ear).toEqual({ kind: 'progression', mode: 'major', degrees: [0, 3, 4] })
    })
  })

  describe('keyboard & circle notation (études 1 & 2)', () => {
    it('scale-spelling questions light up the 7 scale keys, labelled RH/LH', () => {
      for (const q of questions.filter((x) => x.category === 'Scale spelling')) {
        expect(q.keyboard, q.id).toBeDefined()
        expect(q.keyboard!.marks).toHaveLength(7)
        // Every key carries both fingerings (RH = label, LH = sublabel).
        expect(
          q.keyboard!.marks.every((m) => m.label !== undefined && m.sublabel !== undefined),
          q.id
        ).toBe(true)
      }
      // A natural minor: A4 B4 C5 D5 E5 F5 G5 (C wraps up an octave).
      const a = questions.find((x) => x.id === 'scale-notes:A:natural')!
      expect(a.keyboard!.marks.map((m) => m.midi)).toEqual([69, 71, 72, 74, 76, 77, 79])
      expect(a.keyboard!.marks.map((m) => m.label)).toEqual(['1', '2', '3', '1', '2', '3', '4'])
      expect(a.keyboard!.marks.map((m) => m.sublabel)).toEqual(['5', '4', '3', '2', '1', '3', '2'])
    })

    it('fingering questions light up two octaves, each key labelled with its finger', () => {
      for (const q of questions.filter((x) => x.category === 'Fingering')) {
        expect(q.keyboard, q.id).toBeDefined()
        expect(q.keyboard!.marks).toHaveLength(15) // tonic..tonic..tonic
        expect(q.keyboard!.marks.every((m) => m.label !== undefined), q.id).toBe(true)
      }
      const rh = questions.find((x) => x.id === 'fingering:A:RH')!
      expect(rh.keyboard!.marks.map((m) => m.label)).toEqual([
        '1', '2', '3', '1', '2', '3', '4', '1', '2', '3', '1', '2', '3', '4', '5',
      ])
      // First and last keys are the tonic two octaves apart (A4 → A6).
      const m = rh.keyboard!.marks
      expect(m[0].midi).toBe(69)
      expect(m[14].midi).toBe(69 + 24)
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
      const v7 = questions.find((x) => x.id === 'chord-deg:C:major:4:7')!
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
      expect(recog).toHaveLength(308)
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
        expect(q.level, q.id).toBeLessThanOrEqual(3)
        expect(q.explanation, q.id).toBeTruthy() // memory tip on a miss
      }
    })

    it('uses only root / first / second inversion', () => {
      for (const q of recog) {
        const inv = Number(q.id.split(':').pop())
        expect(inv, q.id).toBeLessThanOrEqual(2)
      }
    })

    it('three difficulty levels scale chord complexity and key range', () => {
      const easy = recog.filter((q) => q.level === 1)
      const medium = recog.filter((q) => q.level === 2)
      const hard = recog.filter((q) => q.level === 3)
      expect(easy).toHaveLength(42) // 3 keys × 2 modes × 7
      expect(medium).toHaveLength(98) // 7 keys × 2 modes × 7
      expect(hard).toHaveLength(168) // 12 keys × 2 modes × 7

      // Easy: triads only, root position (no slash chords).
      for (const q of easy) {
        expect(q.notation!.groups[0], q.id).toHaveLength(3)
        expect(q.choices[q.answerIndex], q.id).not.toContain('/')
      }
      // Hard alone introduces the 9th extensions.
      expect(hard.some((q) => q.notation!.groups[0].length === 5)).toBe(true)
      expect(easy.some((q) => q.notation!.groups[0].length === 5)).toBe(false)
      expect(medium.some((q) => q.notation!.groups[0].length === 5)).toBe(false)
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

    it('is a 4-note solfège prompt in both modes', () => {
      expect(melody).toHaveLength(24)
      for (const q of melody) {
        expect(q.ear?.kind).toBe('melody')
        const spec = q.ear as { kind: 'melody'; mode: string; degrees: number[] }
        expect(spec.degrees).toHaveLength(4)
        // Answer is 4 solfège tokens.
        expect(q.choices[q.answerIndex].split('–')).toHaveLength(4)
        expect(q.explanation).toBeTruthy()
      }
      // do mi sol do in major.
      const m = melody.find((x) => x.id === 'melody:major:0240')!
      expect(m.choices[m.answerIndex]).toBe('do–mi–sol–do')
      // do me sol do in minor (flat-3 = "me").
      const n = melody.find((x) => x.id === 'melody:minor:0240')!
      expect(n.choices[n.answerIndex]).toBe('do–me–sol–do')
    })
  })

  describe('rhythm dictation (étude 10)', () => {
    const rhythm = questions.filter((x) => x.category === 'Rhythm dictation')
    const BEATS = { h: 2, q: 1, '8': 0.5, '16': 0.25 } as const

    it('every choice is a valid one-bar 4/4 pattern, aligned to choices', () => {
      expect(rhythm).toHaveLength(18)
      for (const q of rhythm) {
        expect(q.ear?.kind).toBe('rhythm')
        expect(q.rhythmChoices, q.id).toBeDefined()
        expect(q.rhythmChoices!).toHaveLength(q.choices.length)
        for (const pattern of q.rhythmChoices!) {
          const beats = pattern.reduce(
            (s, e) => s + BEATS[e.dur] * (2 - 1 / 2 ** (e.dots ?? 0)),
            0
          )
          expect(beats, q.id).toBeCloseTo(4, 5)
        }
        expect(q.explanation).toBeTruthy()
      }
    })
  })
})
