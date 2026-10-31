export default function ResultLoading() {
  return (
    <main className="rs-page">
      <div className="rs-skeleton-page" aria-hidden="true">
        <div className="rs-skeleton-bar" />
        <div className="rs-skeleton-card rs-skeleton-hero" />
        <div className="rs-skeleton-card rs-skeleton-row" />
        <div className="rs-skeleton-card rs-skeleton-hero" />
      </div>
    </main>
  )
}
