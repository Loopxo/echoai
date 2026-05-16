export default function SignUpPage() {
  return (
    <main className="auth-page">
      <form className="auth-panel" action="/api/echoai/auth/sign-up">
        <p className="eyebrow">EchoAI Web</p>
        <h1>Create workspace</h1>
        <input name="email" type="email" placeholder="you@example.com" required />
        <input name="workspace" placeholder="Workspace name" required />
        <button type="submit">Create account</button>
        <a href="/auth/sign-in">Sign in</a>
      </form>
    </main>
  );
}
