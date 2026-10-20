'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, Target } from 'lucide-react'
import { useEffect, useState } from 'react'

function greeting(hour: number) { return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening' }
export default function HomePage() {
  const [salutation, setSalutation] = useState('Good morning')
  useEffect(() => setSalutation(greeting(new Date().getHours())), [])
  return <div className="home-page"><header className="page-header"><div><p className="eyebrow">Your study desk</p><h1>{salutation}.</h1><p className="lede">Small, consistent practice adds up.</p></div></header><section className="welcome-card"><div><h2>Your next score starts here.</h2><p>Build confidence with focused practice built around the exams that matter.</p><Link href="/practice" className="primary-button">Explore practice <ArrowRight size={17}/></Link></div><div className="welcome-mark" aria-hidden="true"><img src="/brand/pastq-mark.svg" alt=""/></div></section><div className="section-heading"><div><p className="eyebrow">Start learning</p><h2>Choose your pace</h2></div><span className="muted-label">No account needed</span></div><div className="home-grid"><Link href="/practice" className="feature-card"><div className="feature-icon navy"><BookOpen size={21}/></div><h3>Practice questions</h3><p>Take your time. Learn from every answer.</p><span className="card-link">Browse subjects <ArrowRight size={16}/></span></Link><Link href="/cbt" className="feature-card"><div className="feature-icon saffron"><Target size={21}/></div><h3>Try a CBT</h3><p>When you&apos;re ready, test your pace and focus.</p><span className="card-link">View exam mode <ArrowRight size={16}/></span></Link></div><p className="ios-hint">On iPhone? Tap Share, then <strong>Add to Home Screen</strong> to keep PastQ close.</p></div>
}
