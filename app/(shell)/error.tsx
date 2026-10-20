'use client'
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="error-state"><span className="eyebrow">A small pause</span><h1>PastQ needs a moment.</h1><p>Something didn&apos;t load as expected. Try again.</p><button className="primary-button" onClick={reset}>Try again</button></main> }
