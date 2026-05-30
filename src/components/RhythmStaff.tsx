import { useEffect, useRef, useState } from 'react'
import type { RhythmEvent, TimeSig } from '../contracts'
import { ensureMusicFont } from './vexFont'

/**
 * One bar of rhythm in a given metre on a clef-less staff, used as the answer
 * choices of the rhythm-dictation étude. The time signature is printed; notes
 * sit on the middle line; rests, dots, triplets, and beams (grouped per metre)
 * are rendered. VexFlow is lazy-loaded and gated on the Bravura font.
 */

const INK = '#211c15'

/** VexFlow duration token: base + dots ('d') + rest ('r'), e.g. 'qd', '16', '8r'. */
const vexDuration = (e: RhythmEvent): string =>
  `${e.dur}${'d'.repeat(e.dots ?? 0)}${e.rest ? 'r' : ''}`

interface RhythmStaffProps {
  pattern: RhythmEvent[]
  meter?: TimeSig
}

export default function RhythmStaff({ pattern, meter = '4/4' }: RhythmStaffProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [num, den] = meter.split('/').map(Number)
  const width = 40 + pattern.length * 30 + 14 // 40px lead for the time signature

  useEffect(() => {
    let cancelled = false
    const host = ref.current
    if (!host) return
    void (async () => {
      try {
        const vexflow = await import('vexflow')
        await ensureMusicFont()
        if (cancelled || !ref.current) return
        const {
          Renderer,
          Stave,
          StaveNote,
          Dot,
          Beam,
          Tuplet,
          StaveTie,
          Stem,
          Voice,
          Formatter,
        } = vexflow
        ref.current.innerHTML = ''
        const renderer = new Renderer(ref.current, Renderer.Backends.SVG)
        renderer.resize(width, 92)
        const ctx = renderer.getContext()
        ctx.setFillStyle(INK)
        ctx.setStrokeStyle(INK)
        const stave = new Stave(0, 10, width)
        // Cut time is drawn with the ₵ symbol; everything else as n/d.
        stave.addTimeSignature(meter === '2/2' ? 'C|' : meter)
        stave.setContext(ctx).draw()

        const notes = pattern.map(
          (e) => new StaveNote({ keys: ['b/4'], duration: vexDuration(e) })
        )
        // Stems up: beams and tuplet brackets then sit in the space above the
        // staff (VexFlow reserves it) instead of being clipped off the bottom.
        notes.forEach((n) => n.setStemDirection(Stem.UP))
        // Draw augmentation dots (ticks already come from the 'd' in the duration).
        notes.forEach((note, i) => {
          for (let d = 0; d < (pattern[i].dots ?? 0); d++) {
            Dot.buildAndAttach([note], { all: true })
          }
        })
        // Each run of 3 triplet eighths becomes a 3:2 tuplet (adjusts ticks to
        // one beat, and shows the "3" bracket).
        const tuplets = []
        for (let i = 0; i < pattern.length; i++) {
          if (pattern[i].triplet) {
            tuplets.push(
              new Tuplet(notes.slice(i, i + 3), { numNotes: 3, notesOccupied: 2 })
            )
            i += 2
          }
        }
        const voice = new Voice({ numBeats: num, beatValue: den })
        voice.setMode(Voice.Mode.SOFT)
        voice.addTickables(notes)
        // Beam by the metre's beat groups (e.g. 6/8 → two groups of three).
        const beams = Beam.applyAndGetBeams(voice, Stem.UP, Beam.getDefaultBeamGroups(meter))
        new Formatter()
          .joinVoices([voice])
          .format([voice], width - stave.getNoteStartX() - 14)
        voice.draw(ctx, stave)
        beams.forEach((b) => b.setContext(ctx).draw())
        tuplets.forEach((t) => t.setContext(ctx).draw())
        // Tie curves: each event flagged `tie` connects to the next note.
        pattern.forEach((e, i) => {
          if (e.tie && notes[i + 1]) {
            new StaveTie({ firstNote: notes[i], lastNote: notes[i + 1] })
              .setContext(ctx)
              .draw()
          }
        })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (host) host.innerHTML = ''
    }
  }, [width, meter, num, den, JSON.stringify(pattern)])

  if (failed) return null
  return <div ref={ref} className="overflow-x-auto" />
}
