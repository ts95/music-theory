import { useEffect, useRef, useState } from 'react'
import type { Voiced } from '../theory'
import { ensureMusicFont } from './vexFont'

/**
 * Staff notation via VexFlow, lazy-loaded so it stays out of the initial bundle
 * (only used on the reveal of the ear-training études). Renders each group as a
 * quarter-note (a chord if it has several notes), with optional labels beneath.
 */

const ACC: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }
const INK = '#211c15'
const ACCENT = '#7a2540' // claret — used to mark highlighted notes

const vexKey = (v: Voiced): string =>
  `${v.note.letter.toLowerCase()}${ACC[v.note.accidental] ?? ''}/${v.octave}`

interface StaffProps {
  /** Each group is one stave note: 1 note, or several for a chord. */
  groups: Voiced[][]
  /** Optional labels (e.g. Roman numerals) shown under each group. */
  labels?: string[]
  /** Clef to render in (default treble). */
  clef?: 'treble' | 'bass'
  /**
   * VexFlow key-signature spec (e.g. "Eb", "F#m"). When set, the signature is
   * drawn and accidentals are computed relative to it (so in-key notes don't
   * repeat accidentals); when omitted, every altered note prints its accidental.
   */
  keySignature?: string
  /** Indices of groups to colour in the claret accent (e.g. an interval leap). */
  highlight?: number[]
}

export default function Staff({
  groups,
  labels,
  clef = 'treble',
  keySignature,
  highlight,
}: StaffProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  // Notehead centre x of each group, captured after layout so labels sit
  // exactly under their note rather than on a fixed grid that drifts.
  const [noteXs, setNoteXs] = useState<number[]>([])
  const colWidth = 78
  const width = 70 + groups.length * colWidth + (keySignature ? 52 : 0)

  useEffect(() => {
    let cancelled = false
    const host = ref.current
    if (!host) return
    void (async () => {
      try {
        const vexflow = await import('vexflow')
        await ensureMusicFont()
        if (cancelled || !ref.current) return
        const { Renderer, Stave, StaveNote, Accidental, Voice, Formatter } = vexflow
        ref.current.innerHTML = ''
        const renderer = new Renderer(ref.current, Renderer.Backends.SVG)
        renderer.resize(width, 130)
        const ctx = renderer.getContext()
        ctx.setFillStyle(INK)
        ctx.setStrokeStyle(INK)
        const stave = new Stave(0, 12, width)
        stave.addClef(clef)
        if (keySignature) stave.addKeySignature(keySignature)
        stave.setContext(ctx).draw()
        const notes = groups.map((group, gi) => {
          const note = new StaveNote({ keys: group.map(vexKey), duration: 'q', clef })
          // With a key signature, let VexFlow add only the accidentals that
          // deviate from it; otherwise spell every alteration explicitly.
          if (!keySignature) {
            group.forEach((v, i) => {
              const acc = ACC[v.note.accidental]
              if (acc) note.addModifier(new Accidental(acc), i)
            })
          }
          if (highlight?.includes(gi)) {
            note.setStyle({ fillStyle: ACCENT, strokeStyle: ACCENT })
          }
          return note
        })
        const voice = new Voice({ numBeats: notes.length, beatValue: 4 })
        voice.setMode(Voice.Mode.SOFT)
        voice.addTickables(notes)
        if (keySignature) Accidental.applyAccidentals([voice], keySignature)
        const justify = keySignature
          ? width - stave.getNoteStartX() - 16
          : width - 70
        new Formatter().joinVoices([voice]).format([voice], justify)
        voice.draw(ctx, stave)
        if (!cancelled) {
          setNoteXs(
            notes.map((n) => (n.getNoteHeadBeginX() + n.getNoteHeadEndX()) / 2)
          )
        }
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (host) host.innerHTML = ''
    }
  }, [width, clef, keySignature, JSON.stringify(groups), JSON.stringify(highlight)])

  if (failed) return null

  const showLabels = labels && noteXs.length === labels.length

  return (
    <div className="mt-3 overflow-x-auto">
      <div ref={ref} />
      {showLabels && (
        <div className="relative" style={{ width, height: 20 }}>
          {labels!.map((label, i) => (
            <span
              key={i}
              className="absolute font-mono text-sm text-ink-2 -translate-x-1/2"
              style={{ left: noteXs[i] }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
