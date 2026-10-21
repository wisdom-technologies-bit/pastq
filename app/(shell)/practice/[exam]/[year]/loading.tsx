export default function Loading(){return <div className="subject-list" aria-busy="true">{Array.from({length:6}).map((_,i)=><div className="skeleton-row" key={i}/>)}</div>}
