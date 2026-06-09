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
const COUNT = '#5a5142' // ink-2 — the counting syllables read as a quiet guide
const ACCENT = '#7a2540' // claret — the "play it now" playhead glow

/** VexFlow duration token: base + dots ('d') + rest ('r'), e.g. 'qd', '16', '8r'. */
const vexDuration = (e: RhythmEvent): string =>
  `${e.dur}${'d'.repeat(e.dots ?? 0)}${e.rest ? 'r' : ''}`

interface RhythmStaffProps {
  pattern: RhythmEvent[]
  meter?: TimeSig
  /**
   * Optional per-event notehead colours (CSS colour strings), aligned to
   * `pattern` — an `undefined` entry keeps the default ink. Used by the
   * tap-along results screen to show, note by note, how each onset was hit.
   */
  eventColors?: (string | undefined)[]
  /**
   * Optional counting syllable under each note (aligned to `pattern`; `null` =
   * none). Used by the tap-along ready screen to show how to count the rhythm.
   */
  counts?: (string | null)[]
  /**
   * Optional index into `pattern` whose note head should "light up" — a claret
   * glow drawn as an overlay (no VexFlow redraw). Used by the tap-along count-in
   * preview and "Hear it" playback to cue when to play each note. `null` = none.
   */
  highlightIndex?: number | null
}

export default function RhythmStaff({
  pattern,
  meter = '4/4',
  eventColors,
  counts,
  highlightIndex,
}: RhythmStaffProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  // Per-note-head centres (px in SVG coords), captured after each draw, so the
  // highlight overlay can be positioned without re-running VexFlow.
  const [geom, setGeom] = useState<{ xs: number[]; ys: number[] } | null>(null)
  const [num, den] = meter.split('/').map(Number)
  const width = 40 + pattern.length * 30 + 14 // 40px lead for the time signature
  const height = counts ? 172 : 92 // extra room below the staff for the counts

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
          Fraction,
          Tuplet,
          StaveTie,
          Stem,
          Voice,
          Formatter,
          Annotation,
          AnnotationVerticalJustify,
        } = vexflow
        ref.current.innerHTML = ''
        const renderer = new Renderer(ref.current, Renderer.Backends.SVG)
        renderer.resize(width, height)
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
        // Optional per-note feedback colouring (tap-along results).
        if (eventColors) {
          notes.forEach((note, i) => {
            const c = eventColors[i]
            if (c) note.setStyle({ fillStyle: c, strokeStyle: c })
          })
        }
        // Optional counting syllable under each note (tap-along ready screen).
        if (counts) {
          notes.forEach((note, i) => {
            const c = counts[i]
            if (c == null) return
            const a = new Annotation(c)
            a.setVerticalJustification(AnnotationVerticalJustify.BOTTOM)
            a.setStyle({ fillStyle: COUNT, strokeStyle: COUNT })
            note.addModifier(a, 0)
          })
        }
        // Draw augmentation dots (ticks already come from the 'd' in the duration).
        notes.forEach((note, i) => {
          for (let d = 0; d < (pattern[i].dots ?? 0); d++) {
            Dot.buildAndAttach([note], { all: true })
          }
        })
        // Each run of 3 triplet events becomes a 3:2 tuplet (three in the time
        // of two of the written value — eighth, quarter, half, or sixteenth —
        // with the "3" bracket).
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
        // VexFlow's defaults don't know the asymmetric groupings, so 5/8 (3+2)
        // and 7/8 (2+2+3) pass theirs explicitly.
        const beamGroups =
          meter === '5/8'
            ? [new Fraction(3, 8), new Fraction(2, 8)]
            : meter === '7/8'
              ? [new Fraction(2, 8), new Fraction(2, 8), new Fraction(3, 8)]
              : Beam.getDefaultBeamGroups(meter)
        const beams = Beam.applyAndGetBeams(voice, Stem.UP, beamGroups)
        new Formatter()
          .joinVoices([voice])
          .format([voice], width - stave.getNoteStartX() - 14)
        voice.draw(ctx, stave)
        beams.forEach((b) => b.setContext(ctx).draw())
        tuplets.forEach((t) => t.setContext(ctx).draw())
        // Capture each note head's centre so the highlight overlay can sit on it
        // (positions are only valid after format + draw).
        const xs = notes.map((n) => {
          try {
            return (n.getNoteHeadBeginX() + n.getNoteHeadEndX()) / 2
          } catch {
            return n.getAbsoluteX()
          }
        })
        const ys = notes.map((n) => {
          try {
            const y = n.getYs()
            return y && y.length ? y[0] : 40
          } catch {
            return 40
          }
        })
        setGeom({ xs, ys })
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
  }, [width, height, meter, num, den, JSON.stringify(pattern), JSON.stringify(eventColors), JSON.stringify(counts)])

  if (failed) return null
  const lit =
    highlightIndex != null && geom && geom.xs[highlightIndex] != null
      ? { x: geom.xs[highlightIndex], y: geom.ys[highlightIndex] }
      : null
  return (
    <div className="relative">
      <div ref={ref} className="overflow-x-auto" />
      {lit && (
        <span
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: lit.x,
            top: lit.y,
            width: 26,
            height: 26,
            background: `radial-gradient(circle, ${ACCENT}66 0%, ${ACCENT}33 45%, transparent 70%)`,
          }}
        />
      )}
    </div>
  )
}
