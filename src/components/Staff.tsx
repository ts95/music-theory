import { useEffect, useRef, useState } from 'react'
import type { Voiced } from '../theory'

/**
 * Staff notation via VexFlow, lazy-loaded so it stays out of the initial bundle
 * (only used on the reveal of the ear-training études). Renders each group as a
 * quarter-note (a chord if it has several notes), with optional labels beneath.
 */

const ACC: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }
const INK = '#211c15'

const vexKey = (v: Voiced): string =>
  `${v.note.letter.toLowerCase()}${ACC[v.note.accidental] ?? ''}/${v.octave}`

interface StaffProps {
  /** Each group is one stave note: 1 note, or several for a chord. */
  groups: Voiced[][]
  /** Optional labels (e.g. Roman numerals) shown under each group. */
  labels?: string[]
}

export default function Staff({ groups, labels }: StaffProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const colWidth = 78
  const width = 70 + groups.length * colWidth

  useEffect(() => {
    let cancelled = false
    const host = ref.current
    if (!host) return
    void (async () => {
      try {
        const { Renderer, Stave, StaveNote, Accidental, Voice, Formatter } =
          await import('vexflow')
        if (cancelled || !ref.current) return
        ref.current.innerHTML = ''
        const renderer = new Renderer(ref.current, Renderer.Backends.SVG)
        renderer.resize(width, 130)
        const ctx = renderer.getContext()
        ctx.setFillStyle(INK)
        ctx.setStrokeStyle(INK)
        const stave = new Stave(0, 12, width)
        stave.addClef('treble')
        stave.setContext(ctx).draw()
        const notes = groups.map((group) => {
          const note = new StaveNote({ keys: group.map(vexKey), duration: 'q' })
          group.forEach((v, i) => {
            const acc = ACC[v.note.accidental]
            if (acc) note.addModifier(new Accidental(acc), i)
          })
          return note
        })
        const voice = new Voice({ numBeats: notes.length, beatValue: 4 })
        voice.setMode(Voice.Mode.SOFT)
        voice.addTickables(notes)
        new Formatter().joinVoices([voice]).format([voice], width - 70)
        voice.draw(ctx, stave)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (host) host.innerHTML = ''
    }
  }, [width, JSON.stringify(groups)])

  if (failed) return null

  return (
    <div className="mt-3 overflow-x-auto">
      <div ref={ref} />
      {labels && (
        <div className="flex pl-[58px]" style={{ width }}>
          {labels.map((label, i) => (
            <span
              key={i}
              className="font-mono text-sm text-ink-2"
              style={{ width: colWidth, textAlign: 'center' }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
