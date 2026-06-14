export { LETTER_PC, pitchClass, noteToString } from './notes'
export { KEYS } from './keys'
export {
  majorScale,
  minorScale,
  dorianScale,
  phrygianScale,
  lydianScale,
  mixolydianScale,
  locrianScale,
} from './scales'
export { fingering, majorFingering, chordFingering, chordInversionFingering } from './fingerings'
export type { Mode, Quality, Chord } from './chords'
export {
  chordSymbol,
  spellChord,
  diatonicTriads,
  diatonicSevenths,
  romanLabel,
  romanToChord,
  alternateQuality,
  qualityFromIntervals,
  QUALITY_INTERVALS,
} from './chords'
export type { ChordSize } from './recognition'
export {
  recChordTones,
  recChordSymbol,
  isCleanNinth,
  withInversion,
  voiceInversion,
  keySignatureSpec,
} from './recognition'
export { noteMidi, scaleEvents, chordEvents, progressionEvents } from './midi'
export { intervalShorthand } from './intervals'
export {
  realizeEar,
  solfege,
  voicedMidi,
  voiceScaleAscending,
  voiceChordRootPosition,
  INTERVAL_ROOTS,
  progressionTonics,
} from './eartraining'
export type { Voiced, RealizedEar } from './eartraining'
