export default function Loading(){return <div className="browse-grid" aria-busy="true">{Array.from({length:4}).map((_,i)=><div className="skeleton-card" key={i}/>)}</div>}
