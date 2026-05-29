import { KEYS, noteToString, pitchClass } from '../theory'

/**
 * The circle of fifths: the 12 major keys on the outer ring, their relative
 * minors on the inner ring, with one key pair highlighted. Shown on the reveal
 * of relative-minor recall questions so the relationship is placed in its
 * familiar geography. Pure SVG, styled with the Engraved tokens.
 */

interface CircleOfFifthsProps {
  /** Display name of the major key to highlight, e.g. "E♭ major". */
  major: string
}

const CX = 130
const CY = 130
const R_MAJOR = 104 // major-label ring
const R_MINOR = 68 // minor-label ring
const R_OUTER = 122
const R_DIVIDER = 86
const R_INNER = 50

// Clockwise from C at 12 o'clock: each key's slot is its distance in fifths
// from C (fifthsIndex = 7·pitchClass mod 12), 30° apart.
const SLOTS = KEYS.map((key) => {
  const fifths = (7 * pitchClass(key.majorTonic)) % 12
  const angle = ((fifths * 30 - 90) * Math.PI) / 180
  return { key, cos: Math.cos(angle), sin: Math.sin(angle) }
})

export default function CircleOfFifths({ major }: CircleOfFifthsProps) {
  return (
    <div className="mt-3 flex justify-center">
      <svg viewBox="0 0 260 260" className="w-60 h-60" role="img" aria-label="Circle of fifths">
        <g className="fill-none stroke-rule" strokeWidth={1}>
          <circle cx={CX} cy={CY} r={R_OUTER} />
          <circle cx={CX} cy={CY} r={R_DIVIDER} />
          <circle cx={CX} cy={CY} r={R_INNER} />
        </g>
        {SLOTS.map(({ key, cos, sin }) => {
          const hl = key.majorName === major
          const majX = CX + R_MAJOR * cos
          const majY = CY + R_MAJOR * sin
          const minX = CX + R_MINOR * cos
          const minY = CY + R_MINOR * sin
          return (
            <g key={key.majorName}>
              {hl && (
                <line
                  x1={minX}
                  y1={minY}
                  x2={majX}
                  y2={majY}
                  className="stroke-accent"
                  strokeWidth={2}
                />
              )}
              <circle
                cx={majX}
                cy={majY}
                r={15}
                className={hl ? 'fill-accent' : 'fill-card stroke-rule'}
                strokeWidth={1}
              />
              <text
                x={majX}
                y={majY}
                textAnchor="middle"
                dominantBaseline="central"
                className={`font-mono text-[13px] ${hl ? 'fill-paper' : 'fill-ink'}`}
              >
                {noteToString(key.majorTonic)}
              </text>
              <circle
                cx={minX}
                cy={minY}
                r={13}
                className={hl ? 'fill-paper stroke-accent' : 'fill-card stroke-rule'}
                strokeWidth={hl ? 2 : 1}
              />
              <text
                x={minX}
                y={minY}
                textAnchor="middle"
                dominantBaseline="central"
                className={`font-mono text-[11px] ${hl ? 'fill-accent' : 'fill-ink-3'}`}
              >
                {noteToString(key.minorTonic)}m
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
