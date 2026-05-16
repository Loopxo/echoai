export default function SignInPage() {
  return (
    <main className="auth-page">
      <form className="auth-panel" action="/api/echoai/auth/sign-in">
        <p className="eyebrow">EchoAI Web</p>
        <h1>Sign in</h1>
        <input name="email" type="email" placeholder="you@example.com" required />
        <button type="submit">Continue</button>
        <a href="/auth/sign-up">Create workspace</a>
      </form>
    </main>
  );
}
