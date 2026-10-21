export default function Loading(){return <div className="year-grid" aria-busy="true">{Array.from({length:8}).map((_,i)=><div className="skeleton-card" key={i}/>)}</div>}
