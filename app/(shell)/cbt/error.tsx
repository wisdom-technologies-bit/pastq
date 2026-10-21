'use client'
export default function Error({reset}:{error:Error & {digest?:string};reset:()=>void}){return <div className="empty-state"><p className="eyebrow">CBT mode</p><h1>We couldn&apos;t load this right now.</h1><p>Give it another try and we&apos;ll fetch your exam room.</p><button className="primary-button" onClick={reset}>Retry</button></div>}
