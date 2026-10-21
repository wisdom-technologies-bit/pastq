'use client'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { SubjectRow } from './cards'
import type { ExamSubject } from '@/lib/bank/schemas'
export function SubjectBrowser({ subjects, exam, year, compulsory, signedIn }: { subjects: ExamSubject[]; exam: string; year: number; compulsory?: string | null; signedIn: boolean }) { const [query, setQuery] = useState(''); const sorted = useMemo(() => [...subjects].sort((a,b) => Number(b.slug === compulsory) - Number(a.slug === compulsory) || a.name.localeCompare(b.name)).filter((subject) => subject.name.toLowerCase().includes(query.toLowerCase())), [subjects, compulsory, query]); return <><label className="search-field"><Search size={17} /><span className="sr-only">Search subjects</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects" /></label><div className="subject-list">{sorted.map((subject) => <SubjectRow key={subject.slug} subject={subject} exam={exam} year={year} compulsory={subject.slug === compulsory} signedIn={signedIn} />)}</div></> }
