'use client'
import { useEffect } from 'react'
export default function PlayError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error('[v0] practice player error',error)},[error]);return <main className="player-page player-centered"><h1>We couldn&apos;t load this right now</h1><p>Your session is safe. Try loading the player again.</p><button className="primary-button" onClick={reset}>Retry</button></main>}
