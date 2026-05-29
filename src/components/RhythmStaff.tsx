import { useEffect, useRef, useState } from 'react'
import type { RhythmEvent } from '../contracts'
import { ensureMusicFont } from './vexFont'

/**
 * One bar of 4/4 rhythm on a clef-less staff, used as the answer choices (and
 * the prompt) of the rhythm-dictation étude. Notes sit on the middle line; rests,
 * dots, and beams are rendered. VexFlow is lazy-loaded and gated on the Bravura
 * font (shared with Staff via ensureMusicFont).
 */

const INK = '#211c15'

/** VexFlow duration token: base + dots ('d') + rest ('r'), e.g. 'qd', '16', '8r'. */
const vexDuration = (e: RhythmEvent): string =>
  `${e.dur}${'d'.repeat(e.dots ?? 0)}${e.rest ? 'r' : ''}`

interface RhythmStaffProps {
  pattern: RhythmEvent[]
  /** Show the 4/4 time signature (default false — compact for answer choices). */
  withMeter?: boolean
}

export default function RhythmStaff({ pattern, withMeter = false }: RhythmStaffProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const lead = withMeter ? 52 : 14
  const width = lead + pattern.length * 30 + 14

  useEffect(() => {
    let cancelled = false
    const host = ref.current
    if (!host) return
    void (async () => {
      try {
        const vexflow = await import('vexflow')
        await ensureMusicFont()
        if (cancelled || !ref.current) return
        const { Renderer, Stave, StaveNote, Dot, Beam, Voice, Formatter, Fraction } =
          vexflow
        ref.current.innerHTML = ''
        const renderer = new Renderer(ref.current, Renderer.Backends.SVG)
        renderer.resize(width, 92)
        const ctx = renderer.getContext()
        ctx.setFillStyle(INK)
        ctx.setStrokeStyle(INK)
        const stave = new Stave(0, 10, width)
        if (withMeter) stave.addTimeSignature('4/4')
        stave.setContext(ctx).draw()

        const notes = pattern.map(
          (e) => new StaveNote({ keys: ['b/4'], duration: vexDuration(e) })
        )
        // Draw augmentation dots (ticks already come from the 'd' in the duration).
        notes.forEach((note, i) => {
          for (let d = 0; d < (pattern[i].dots ?? 0); d++) {
            Dot.buildAndAttach([note], { all: true })
          }
        })
        const voice = new Voice({ numBeats: 4, beatValue: 4 })
        voice.setMode(Voice.Mode.SOFT)
        voice.addTickables(notes)
        // Beam eighths/sixteenths within each beat.
        const beams = Beam.generateBeams(notes, { groups: [new Fraction(1, 4)] })
        new Formatter()
          .joinVoices([voice])
          .format([voice], width - stave.getNoteStartX() - 14)
        voice.draw(ctx, stave)
        beams.forEach((b) => b.setContext(ctx).draw())
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (host) host.innerHTML = ''
    }
  }, [width, withMeter, JSON.stringify(pattern)])

  if (failed) return null
  return <div ref={ref} className="overflow-x-auto" />
}
