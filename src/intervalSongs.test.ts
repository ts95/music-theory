import { describe, expect, it } from 'vitest'
import { INTERVAL_SONGS, intervalSongBySemitones } from './intervalSongs'
import { voicedMidi } from './theory'

describe('interval songs', () => {
  it('covers every ascending interval m2..octave exactly once', () => {
    const semis = INTERVAL_SONGS.map((s) => s.semitones).sort((a, b) => a - b)
    expect(semis).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it("each song's leap spans exactly its stated interval", () => {
    for (const s of INTERVAL_SONGS) {
      const [a, b] = s.leap
      const span = voicedMidi(s.notes[b]) - voicedMidi(s.notes[a])
      expect(span, `${s.song} (${s.name})`).toBe(s.semitones)
    }
  })

  it('labels, when present, match the note count', () => {
    for (const s of INTERVAL_SONGS) {
      if (s.labels) expect(s.labels.length, s.song).toBe(s.notes.length)
    }
  })

  it('is looked up by semitone span', () => {
    expect(intervalSongBySemitones(7)?.name).toBe('P5')
    expect(intervalSongBySemitones(99)).toBeNull()
  })
})
