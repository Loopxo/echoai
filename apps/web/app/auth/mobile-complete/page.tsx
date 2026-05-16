export default function MobileCompletePage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Mobile auth</p>
        <h1>Mobile sign-in complete</h1>
        <p>The mobile app can finish web-based auth through the EchoAI deep link callback.</p>
        <a className="primary-action" href="/app/devices">
          View devices
        </a>
      </section>
    </main>
  );
}
