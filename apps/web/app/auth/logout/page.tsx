export default function LogoutPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Signed out</p>
        <h1>Session revoked</h1>
        <p>The session cookie was revoked and the user is returned to public auth.</p>
        <a className="primary-action" href="/auth/sign-in">
          Sign in
        </a>
      </section>
    </main>
  );
}
