"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Recovery</p>
        <h1>EchoAI hit a route error</h1>
        <p>{error.message || "The app could not render this route."}</p>
        <button type="button" onClick={reset}>
          Retry
        </button>
      </section>
    </main>
  );
}
