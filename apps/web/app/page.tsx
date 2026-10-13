export default function HomePage() {
  return (
    <main className="page-shell">
      <div className="eyebrow">OURS PRIVACY · ENGINEERING TAKE-HOME</div>
      <h1>Image Processing Playground</h1>
      <p className="intro">
        A simple workspace for exploring image transformations. The interactive
        controls will be added in the next milestone.
      </p>
      <section className="status-card" aria-live="polite">
        <span className="status-dot" />
        <div>
          <strong>Project scaffold ready</strong>
          <p>
            The API and UI are separated and ready for incremental
            implementation.
          </p>
        </div>
      </section>
      <p className="footnote">
        Local API target:{" "}
        <code>
          {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}
        </code>
      </p>
    </main>
  );
}
