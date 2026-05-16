export default function AuthCallbackPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Callback</p>
        <h1>Session created</h1>
        <p>Auth provider callback exchanged the code and created the web session cookie.</p>
        <a className="primary-action" href="/app">
          Continue
        </a>
      </section>
    </main>
  );
}
