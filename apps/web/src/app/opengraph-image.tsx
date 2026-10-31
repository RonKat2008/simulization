import { ImageResponse } from 'next/og'

export const alt = 'Simulization: do AI models favor their own maker?'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  const squares = ['#5aa8ff', '#f5b13d', '#2fd4bd', '#2f7fff']
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#05060a',
          color: '#e6eaf4',
          padding: 72,
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', width: 44, gap: 4 }}>
            {squares.map((c) => (
              <div key={c} style={{ width: 20, height: 20, background: c }} />
            ))}
          </div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>Simulization</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, display: 'flex', flexWrap: 'wrap' }}>
            <span>Do AI models favor their own maker, and lie to&nbsp;</span>
            <span style={{ color: '#ff6fb3' }}>everyone else?</span>
          </div>
          <div style={{ fontSize: 28, color: '#8b93a7' }}>
            LABELED vs BLIND · 18 agents · 3 labs · checked against ground truth
          </div>
        </div>
        <div style={{ height: 6, width: 240, background: '#2f7fff', display: 'flex' }} />
      </div>
    ),
    size,
  )
}
