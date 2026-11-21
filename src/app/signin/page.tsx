import SignInForm from "./signin-form";

export default function SignInPage() {
  return <main className="form-page">
    <a href="/" className="action-link">AI Job Automation</a>
    <h1 style={{ fontSize: 32, marginBottom: 8 }}>Sign in</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Access your private job-search workspace. If two-factor authentication is enabled, provide your selected second-factor code.</p>
    <SignInForm />
    <p style={{ fontSize: 12, color: "#788397", lineHeight: 1.6, marginTop: 24 }}>Your email must be verified before password sign-in. Google sign-in appears only when OAuth credentials are configured.</p>
    <p style={{ marginTop: 16 }}><a href="/forgot-password" style={{ color: "#3657a7" }}>Forgot password?</a> · <a href="/recover-two-factor" style={{ color: "#3657a7" }}>Lost authenticator access?</a></p>
    <p style={{ marginTop: 16 }}><a href="/register" style={{ color: "#3657a7" }}>Create an account</a> · <a href="/verify-email" style={{ color: "#3657a7" }}>Verify email</a></p>
  </main>;
}
