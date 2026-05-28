import { describe, expect, it } from 'vitest'
import { generateAllQuestions } from './generators'
import { KEYS, fingering } from '../theory'

const questions = generateAllQuestions()

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
    expect(questions.length).toBe(12 + 36 + fingeringCount)
    expect(questions.length).toBeGreaterThanOrEqual(70)
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

  it('is deterministic across calls', () => {
    expect(generateAllQuestions()).toEqual(generateAllQuestions())
  })
})
