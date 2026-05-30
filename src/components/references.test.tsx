import { describe, expect, it } from 'vitest'
import { ETUDES } from '../questions/etudes'
import { etudeReference } from './references'

describe('etude reference boxes', () => {
  it('every étude has an (open-by-default) reference box with a title and body', () => {
    for (const e of ETUDES) {
      const ref = etudeReference(e.id)
      expect(ref, e.id).not.toBeNull()
      expect(ref!.title.length, e.id).toBeGreaterThan(0)
      expect(ref!.body, e.id).toBeTruthy()
      expect(ref!.defaultOpen, e.id).toBe(true)
    }
  })

  it('returns null for an unknown étude id', () => {
    expect(etudeReference('nope')).toBeNull()
  })
})
