import { ImageResponse } from 'next/og'

export const alt = 'PastQ — Practice with purpose'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() { return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: '#0C2444', color: '#fff' }}><div style={{ fontSize: 32, color: '#F2A413', marginBottom: 28 }}>PastQ</div><div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, display: 'flex', flexDirection: 'column' }}><span>Practice with purpose.</span><span>Walk into the exam ready.</span></div><div style={{ fontSize: 28, marginTop: 36, color: '#C8D5E5' }}>Focused preparation for Nigerian students.</div></div>, size) }
