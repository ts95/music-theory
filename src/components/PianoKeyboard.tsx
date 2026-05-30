import type { KeyMark } from '../contracts'

/**
 * A piano-keyboard diagram shown on the reveal of the scale/chord/fingering
 * études: the relevant keys lit in claret, with optional finger-number labels
 * (one number, or two stacked — RH over LH — for scale spelling). Pure SVG
 * styled with the Engraved tokens (like CircleOfFifths) — no audio, no
 * lazy-load. By default it sizes itself to the marks (starting on the C at/below
 * the lowest key, ending on the C at/above the highest), so it spans however
 * many octaves the notes need — one for a triad, three for a two-octave scale
 * rooted high on the keyboard.
 *
 * Highlights are drawn as an inset pill within each key (not edge-to-edge fill),
 * so adjacent lit keys keep a clear margin instead of bleeding together.
 */

interface PianoKeyboardProps {
  marks: KeyMark[]
  /** Override the start key (a C, as MIDI). Defaults to the C at/below the lowest mark. */
  from?: number
  /** Override the octave count. Defaults to however many cover the highest mark. */
  octaves?: number
  /** When set, keys are tappable/clickable and call this with the key's MIDI. */
  onPress?: (midi: number) => void
  /** A key (MIDI) to render momentarily "pressed" (struck via tap or MIDI). */
  pressed?: number | null
}

const WW = 28 // white-key width
const WH = 118 // white-key height
const BW = 17 // black-key width
const BH = 74 // black-key height
const WPAD = 3.5 // inset of a white key's highlight pill
const BPAD = 2.5 // inset of a black key's highlight pill

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B
const HAS_BLACK_AFTER = new Set([0, 2, 5, 7, 9]) // C D F G A → C# D# F# G# A#

const mod = (n: number, m: number) => ((n % m) + m) % m

export default function PianoKeyboard({
  marks,
  from,
  octaves,
  onPress,
  pressed,
}: PianoKeyboardProps) {
  // Nothing to draw if there are no marks and no explicit range (read-only use).
  if (marks.length === 0 && (from === undefined || octaves === undefined)) {
    return null
  }

  const midis = marks.map((m) => m.midi)
  const lo = midis.length ? Math.min(...midis) : from!
  const hi = midis.length ? Math.max(...midis) : from! + octaves! * 12
  const start = from ?? lo - mod(lo, 12) // the C at/below the lowest mark
  const top = hi + mod(-hi, 12) // the C at/above the highest mark
  const oct = octaves ?? Math.max(1, (top - start) / 12)

  const marked = new Map(marks.map((m) => [m.midi, m]))

  // White keys: each octave's seven naturals, plus a closing C.
  const whites: { midi: number; pc: number; x: number }[] = []
  for (let o = 0; o < oct; o++) {
    for (const pc of WHITE_PCS) {
      whites.push({ midi: start + o * 12 + pc, pc, x: whites.length * WW })
    }
  }
  whites.push({ midi: start + oct * 12, pc: 0, x: whites.length * WW })

  // Black keys sit to the upper-right of certain whites (never after the last).
  const blacks = whites.slice(0, -1).flatMap((w, i) =>
    HAS_BLACK_AFTER.has(w.pc) ? [{ midi: w.midi + 1, cx: (i + 1) * WW }] : []
  )

  const width = whites.length * WW

  /** Stacked finger-number labels centred at `cx`, sitting just above `bottom`. */
  const labels = (mark: KeyMark | undefined, cx: number, bottom: number, size: number) => {
    if (!mark?.label) return null
    const lh = mark.sublabel
    return (
      <>
        <text
          x={cx}
          y={lh ? bottom - size - 3 : bottom}
          textAnchor="middle"
          className="fill-paper font-mono"
          style={{ fontSize: size }}
        >
          {mark.label}
        </text>
        {lh && (
          <text
            x={cx}
            y={bottom}
            textAnchor="middle"
            className="fill-paper font-mono"
            style={{ fontSize: size }}
          >
            {lh}
          </text>
        )}
      </>
    )
  }

  return (
    <div className="mt-3 flex justify-center overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${WH}`}
        width={width}
        height={WH}
        role="img"
        aria-label="Piano keyboard"
        className="shrink-0"
      >
        {/* White keys (base), then their highlight pills. */}
        {whites.map((w) => (
          <rect
            key={`w${w.midi}`}
            x={w.x}
            y={0}
            width={WW}
            height={WH}
            rx={4}
            className={`fill-card stroke-rule${onPress ? ' cursor-pointer' : ''}`}
            strokeWidth={1}
            data-midi={w.midi}
            onPointerDown={onPress ? () => onPress(w.midi) : undefined}
          />
        ))}
        {whites.map((w) =>
          marked.has(w.midi) ? (
            <rect
              key={`wp${w.midi}`}
              x={w.x + WPAD}
              y={WPAD}
              width={WW - 2 * WPAD}
              height={WH - 2 * WPAD}
              rx={3}
              className="pointer-events-none fill-accent"
            />
          ) : null
        )}
        {/* Black keys (base), then their highlight pills, on top. */}
        {blacks.map((b) => (
          <rect
            key={`b${b.midi}`}
            x={b.cx - BW / 2}
            y={0}
            width={BW}
            height={BH}
            rx={3}
            className={`fill-ink stroke-ink${onPress ? ' cursor-pointer' : ''}`}
            strokeWidth={1}
            data-midi={b.midi}
            onPointerDown={onPress ? () => onPress(b.midi) : undefined}
          />
        ))}
        {blacks.map((b) =>
          marked.has(b.midi) ? (
            <rect
              key={`bp${b.midi}`}
              x={b.cx - BW / 2 + BPAD}
              y={BPAD}
              width={BW - 2 * BPAD}
              height={BH - 2 * BPAD}
              rx={2}
              className="pointer-events-none fill-accent"
            />
          ) : null
        )}
        {/* Finger-number labels (only ever on highlighted keys). */}
        {whites.map((w) => (
          <g key={`wl${w.midi}`} className="pointer-events-none">
            {labels(marked.get(w.midi), w.x + WW / 2, WH - 14, 13)}
          </g>
        ))}
        {blacks.map((b) => (
          <g key={`bl${b.midi}`} className="pointer-events-none">
            {labels(marked.get(b.midi), b.cx, BH - 11, 10)}
          </g>
        ))}
        {/* Momentary "pressed" feedback: a white key shadows down, a black key
            lights up — so a struck key (tap or MIDI) visibly depresses. */}
        {pressed != null &&
          whites.map((w) =>
            w.midi === pressed ? (
              <rect
                key={`wd${w.midi}`}
                x={w.x}
                y={6}
                width={WW}
                height={WH - 6}
                rx={4}
                className="pointer-events-none fill-ink opacity-25"
              />
            ) : null
          )}
        {pressed != null &&
          blacks.map((b) =>
            b.midi === pressed ? (
              <rect
                key={`bd${b.midi}`}
                x={b.cx - BW / 2}
                y={4}
                width={BW}
                height={BH - 4}
                rx={3}
                className="pointer-events-none fill-paper opacity-30"
              />
            ) : null
          )}
      </svg>
    </div>
  )
}
