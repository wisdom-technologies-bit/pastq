'use client'

import { useId, useState } from 'react'
import { shortDate } from '@/lib/dates'
import type { TrendPoint } from '@/lib/progress'

const WIDTH = 640
const HEIGHT = 200
const PAD_X = 10
const PAD_TOP = 14
const PAD_BOTTOM = 26

/** Percent over the last sessions, drawn with plain SVG. No chart library. */
export function ProgressTrend({ points, takeaway }: { points: TrendPoint[]; takeaway: string | null }) {
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId().replace(/[:]/g, '')
  const count = points.length
  const innerWidth = WIDTH - PAD_X * 2
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const x = (index: number) => (count <= 1 ? WIDTH / 2 : PAD_X + (index * innerWidth) / (count - 1))
  const y = (percent: number) => PAD_TOP + (1 - Math.min(100, Math.max(0, percent)) / 100) * innerHeight

  let line = ''
  points.forEach((point, index) => {
    const px = x(index)
    const py = y(point.percent)
    if (index === 0) {
      line += `M ${px} ${py}`
    } else {
      const previousX = x(index - 1)
      const previousY = y(points[index - 1].percent)
      const midX = (previousX + px) / 2
      line += ` C ${midX} ${previousY}, ${midX} ${py}, ${px} ${py}`
    }
  })
  const area = line ? `${line} L ${x(count - 1)} ${HEIGHT - PAD_BOTTOM} L ${x(0)} ${HEIGHT - PAD_BOTTOM} Z` : ''
  const band = count > 1 ? innerWidth / (count - 1) : innerWidth
  const activeIndex = active ?? 0
  const activePoint = active === null ? null : points[activeIndex]

  return (
    <div className="pg-chart">
      <div className="pg-chart-canvas" onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="pg-chart-svg" aria-hidden="true" role="presentation">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[50, 75].map((value) => (
            <g key={value}>
              <line x1={PAD_X} x2={WIDTH - PAD_X} y1={y(value)} y2={y(value)} className="pg-chart-grid" />
              <text x={PAD_X + 2} y={y(value) - 5} className="pg-chart-grid-label">
                {value}
              </text>
            </g>
          ))}
          {area && <path d={area} fill={`url(#${gradientId})`} />}
          {line && <path d={line} className="pg-chart-line" />}
          {points.map((point, index) => {
            const isActive = active === index
            if (point.mode === 'cbt') {
              return <circle key={point.id} cx={x(index)} cy={y(point.percent)} r={isActive ? 6.5 : 5} className="pg-chart-dot cbt" />
            }
            return <circle key={point.id} cx={x(index)} cy={y(point.percent)} r={isActive ? 6.5 : 5} className="pg-chart-dot practice" />
          })}
          {points.map((point, index) => (
            <rect
              key={`hit-${point.id}`}
              x={x(index) - band / 2}
              y={0}
              width={band}
              height={HEIGHT}
              fill="transparent"
              onMouseEnter={() => setActive(index)}
              onClick={() => setActive(index)}
            />
          ))}
        </svg>
        {activePoint && (
          <div
            className="pg-chart-tip"
            style={{ left: `${(x(activeIndex) / WIDTH) * 100}%`, top: `${(y(activePoint.percent) / HEIGHT) * 100}%` }}
          >
            <strong>{activePoint.percent}%</strong>
            <span>
              {shortDate(activePoint.date)} · {activePoint.label}
            </span>
          </div>
        )}
      </div>
      {takeaway && <p className="pg-chart-takeaway">{takeaway}</p>}
      <table className="pg-sr-only">
        <caption>Percent score for your last {count} sessions</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Session</th>
            <th scope="col">Type</th>
            <th scope="col">Percent</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <td>{shortDate(point.date)}</td>
              <td>{point.label}</td>
              <td>{point.mode === 'cbt' ? 'CBT' : 'Practice'}</td>
              <td>{point.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
