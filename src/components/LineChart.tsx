/**
 * Minimal hand-rolled SVG line chart (no chart dependency) for the accuracy
 * trends. Y axis is fixed 0–100%. Each series' `values` align to `xLabels`; a
 * null value is a day/period with no data. By default that breaks the line (a
 * gap); with `connectGaps` the line bridges straight to the next data point
 * (markers still only sit on real points), keeping a trajectory continuous
 * across the odd unpractised day on a fixed date axis.
 */

// Axis hairline colors mirror the @theme tokens (--color-rule / --color-ink-3);
// hardcoded because CSS vars aren't reliable in SVG presentation attributes.
const RULE = '#d9cdb5'
const INK3 = '#8a8070'

export interface ChartSeries {
  label: string
  color: string
  values: (number | null)[]
}

interface LineChartProps {
  xLabels: string[]
  series: ChartSeries[]
  ariaLabel?: string
  /** Bridge across null values instead of breaking the line. */
  connectGaps?: boolean
}

const W = 640
const H = 240
const PAD_L = 32
const PAD_R = 12
const PAD_T = 10
const PAD_B = 26
const GRID = [0, 25, 50, 75, 100]

export default function LineChart({ xLabels, series, ariaLabel, connectGaps = false }: LineChartProps) {
  const n = xLabels.length
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const xAt = (i: number) =>
    n <= 1 ? PAD_L + plotW / 2 : PAD_L + (plotW * i) / (n - 1)
  const yAt = (v: number) => PAD_T + plotH * (1 - v / 100)

  // Show at most ~6 x labels to avoid crowding.
  const step = Math.max(1, Math.ceil(n / 6))

  const pathFor = (values: (number | null)[]) => {
    let d = ''
    let pen = false
    values.forEach((v, i) => {
      if (v == null) {
        if (!connectGaps) pen = false
        return
      }
      d += `${pen ? 'L' : 'M'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)} `
      pen = true
    })
    return d.trim()
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 'auto' }}
      role="img"
      aria-label={ariaLabel}
    >
      {GRID.map((v) => (
        <g key={v}>
          <line x1={PAD_L} y1={yAt(v)} x2={W - PAD_R} y2={yAt(v)} stroke={RULE} strokeWidth={1} />
          <text x={PAD_L - 6} y={yAt(v) + 3} textAnchor="end" fill={INK3} fontSize={10} fontFamily="monospace">
            {v}
          </text>
        </g>
      ))}

      {xLabels.map((lbl, i) =>
        i % step === 0 || i === n - 1 ? (
          <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" fill={INK3} fontSize={10} fontFamily="monospace">
            {lbl}
          </text>
        ) : null,
      )}

      {series.map((s, si) => (
        <g key={si}>
          <path
            d={pathFor(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {s.values.map((v, i) =>
            v == null ? null : <circle key={i} cx={xAt(i)} cy={yAt(v)} r={2.5} fill={s.color} />,
          )}
        </g>
      ))}
    </svg>
  )
}
