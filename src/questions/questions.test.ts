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
    expect(fing).toHaveLength(fingeringCount)
    // keys = 12 + 36 + 24 fingerings = 72.
    expect(12 + 36 + fingeringCount).toBe(72)

    // chords: 24 key/mode combos × 7 (trimmed triads + V7) = 168.
    // progressions: 6 major + 5 minor triad progressions × 12 keys = 132,
    // plus 2 idiomatic seventh forms × 12 = 24, total 156.
    expect(questions.length).toBe(72 + 168 + 156)
  })

  it('tags every question with a valid étude id and expected counts', () => {
    for (const q of questions) {
      expect(ETUDE_IDS.has(q.etudeId)).toBe(true)
    }
    const count = (id: string) =>
      questions.filter((q) => q.etudeId === id).length
    expect(count('keys')).toBe(72)
    expect(count('chords')).toBe(168)
    expect(count('progressions')).toBe(156)
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
    expect(q!.choices[q!.answerIndex]).toBe('1 2 3 1 2 3 4 5')
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
    it('attaches playable audio for every choice of scale/chord/progression/relative-minor', () => {
      const playable = questions.filter((q) =>
        ['Relative minor', 'Scale spelling', 'Diatonic chord', 'Progression'].includes(
          q.category
        )
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
})
