'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronDown, Check, Minus, BookOpen, Timer, Layers3 } from 'lucide-react'
import { useState } from 'react'
import { landingImages } from '@/lib/landing/images'

const faqs = [
  ['Can I use PastQ offline?', 'PastQ is designed for a reliable connection. We may support limited offline access later, but questions are never stored on your device.'],
  ['How does activation work?', 'Activation unlocks the full PastQ Bank beyond the latest two years. Plans and payment details will be available soon.'],
  ['Where do the questions come from?', 'Questions are served from the PastQ Bank API at request time. PastQ is independent and is not affiliated with JAMB, WAEC or NECO.'],
]

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  return <div className="landing-page">
    <header className="landing-header"><Link href="/" aria-label="PastQ home"><img src="/brand/pastq-wordmark.svg" alt="PastQ" /></Link><nav><Link href="/sign-in">Sign in</Link><Link href="/sign-in" className="landing-button">Start practising <ArrowRight size={16} /></Link></nav></header>
    <main>
      <section className="landing-hero"><div className="hero-copy"><p className="landing-kicker">A calmer way to prepare</p><h1>Practice with purpose. Walk into the exam ready.</h1><p className="hero-lede">PastQ gives Nigerian students a focused place to work through past questions and build the confidence that comes from knowing what to expect.</p><div className="hero-actions"><Link href="/sign-in" className="landing-button">Start practising <ArrowRight size={17} /></Link><a href="#how-it-works" className="secondary-button">See how it works</a></div></div><div className="hero-photo"><Image src={landingImages.hero.src} alt={landingImages.hero.alt} fill priority sizes="(max-width: 767px) 100vw, 56vw" /><div className="hero-photo-caption"><span>For JAMB, WAEC, NECO and Post-UTME</span><strong>One question at a time.</strong></div></div></section>
      <section className="exam-strip"><p>Exams covered</p><div><span>JAMB</span><span>WAEC</span><span>NECO</span><span>Post-UTME</span></div></section>
      <section className="landing-section ways"><div className="section-intro"><p className="landing-kicker">Choose your mode</p><h2>Two ways to prepare, one clear goal.</h2></div><div className="ways-grid"><article className="way-card dark-card"><div className="way-icon"><BookOpen size={22}/></div><p className="card-number">01</p><h3>Practice by subject and year</h3><p>Take your time with instant answers, thoughtful review and the space to understand why.</p><Link href="/sign-in">Explore practice <ArrowRight size={16}/></Link></article><article className="way-card image-card"><Image src={landingImages.practice.src} alt={landingImages.practice.alt} fill sizes="(max-width: 767px) 100vw, 50vw"/><div className="image-card-content"><div className="way-icon"><Timer size={22}/></div><p className="card-number">02</p><h3>Try a CBT mock exam</h3><p>Build pace and focus in a format shaped around the real exam, with its timer and question flow.</p><Link href="/sign-in">View CBT mode <ArrowRight size={16}/></Link></div></article></div></section>
      <section className="landing-section how" id="how-it-works"><div className="section-intro"><p className="landing-kicker">A simple rhythm</p><h2>How it works</h2></div><div className="steps"><div><span>01</span><h3>Choose your exam</h3><p>Start with the subject and year that matches where you are today.</p></div><div><span>02</span><h3>Work through questions</h3><p>Answer in a quiet, focused space without distractions or noise.</p></div><div><span>03</span><h3>Review and return</h3><p>Learn from each attempt, then come back for the next one.</p></div></div></section>
      <section className="activation-section"><div><p className="landing-kicker">Start free, go further when ready</p><h2>The right amount of access for where you are.</h2><p>Begin with the latest two years of every exam. When you need more range, activation opens every year in the PastQ Bank.</p><Link href="/plans" className="text-link">See plans <ArrowRight size={16}/></Link></div><div className="access-list"><div><Check size={18}/><span><strong>Free</strong>Latest two years of each exam</span></div><div><Layers3 size={18}/><span><strong>Activation</strong>Every available year in the bank</span></div></div></section>
      <section className="landing-section faq-section"><div className="section-intro"><p className="landing-kicker">Good to know</p><h2>Questions, answered.</h2></div><div className="faq-list">{faqs.map(([question, answer], index) => <div className="faq-item" key={question}><button onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}><span>{question}</span>{openFaq === index ? <Minus size={19}/> : <ChevronDown size={19}/>}</button>{openFaq === index && <p>{answer}</p>}</div>)}</div></section>
      <section className="closing-cta"><div><p className="landing-kicker">Your next attempt can be different.</p><h2>Make practice the part you can control.</h2><Link href="/sign-in" className="landing-button">Start practising <ArrowRight size={17}/></Link></div><div className="closing-mark"><img src="/brand/pastq-mark.svg" alt="" /></div></section>
    </main>
    <footer className="landing-footer"><strong>WISDOM TECHNOLOGIES</strong><div><Link href="/sign-in">Sign in</Link><Link href="/plans">Plans</Link><Link href="#how-it-works">How it works</Link></div><span>© 2026 Wisdom Technologies</span></footer><Link href="/sign-in" className="mobile-cta">Start practising <ArrowRight size={17}/></Link>
  </div>
}
