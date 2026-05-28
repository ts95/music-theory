import type { KeyDef, Note } from '../contracts'
import { noteToString } from './notes'

/** Build a KeyDef from major and relative-minor tonics. */
function makeKey(majorTonic: Note, minorTonic: Note): KeyDef {
  return {
    majorTonic,
    minorTonic,
    majorName: `${noteToString(majorTonic)} major`,
    minorName: `${noteToString(minorTonic)} minor`,
  }
}

const nat = (letter: Note['letter']): Note => ({ letter, accidental: 0 })
const sharp = (letter: Note['letter']): Note => ({ letter, accidental: 1 })
const flat = (letter: Note['letter']): Note => ({ letter, accidental: -1 })

/** The 12 keys, in circle-of-fifths order starting at C. major / relative minor. */
export const KEYS: KeyDef[] = [
  makeKey(nat('C'), nat('A')), // C / Am
  makeKey(nat('G'), nat('E')), // G / Em
  makeKey(nat('D'), nat('B')), // D / Bm
  makeKey(nat('A'), sharp('F')), // A / F♯m
  makeKey(nat('E'), sharp('C')), // E / C♯m
  makeKey(nat('B'), sharp('G')), // B / G♯m
  makeKey(sharp('F'), sharp('D')), // F♯ / D♯m
  makeKey(nat('F'), nat('D')), // F / Dm
  makeKey(flat('B'), nat('G')), // B♭ / Gm
  makeKey(flat('E'), nat('C')), // E♭ / Cm
  makeKey(flat('A'), nat('F')), // A♭ / Fm
  makeKey(flat('D'), flat('B')), // D♭ / B♭m
]
