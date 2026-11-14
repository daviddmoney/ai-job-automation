import { signIn } from "@/auth";

async function credentialsSignIn(formData: FormData) {
  "use server";
  await signIn("credentials", {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    redirectTo: "/dashboard"
  });
}

async function googleSignIn() {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}

export default function SignInPage() {
  return <main style={{ maxWidth: 440, margin: "72px auto", padding: 24 }}>
    <a href="/" style={{ color: "#3657a7", fontWeight: 700 }}>AI Job Automation</a>
    <h1 style={{ fontSize: 32, marginBottom: 8 }}>Sign in</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Access your private job-search workspace.</p>
    <form action={credentialsSignIn} style={{ display: "grid", gap: 14, marginTop: 28 }}>
      <label style={{ display: "grid", gap: 6 }}>Email address<input name="email" type="email" autoComplete="email" required style={inputStyle} /></label>
      <label style={{ display: "grid", gap: 6 }}>Password<input name="password" type="password" autoComplete="current-password" required style={inputStyle} /></label>
      <button type="submit" style={buttonStyle}>Sign in securely</button>
    </form>
    <form action={googleSignIn} style={{ marginTop: 12 }}><button type="submit" style={{ ...buttonStyle, background: "white", color: "#172033", border: "1px solid #d8deea" }}>Continue with Google</button></form>
    <p style={{ fontSize: 12, color: "#788397", lineHeight: 1.6, marginTop: 24 }}>You must verify your email before signing in with a password. Google sign-in is available only after OAuth credentials are configured.</p>\n    <p style={{ marginTop: 16 }}><a href="/register" style={{ color: "#3657a7" }}>Create an account</a> · <a href="/verify-email" style={{ color: "#3657a7" }}>Verify email</a></p>
  </main>;
}

const inputStyle = { width: "100%", padding: "12px 14px", border: "1px solid #d8deea", borderRadius: 9, fontSize: 15 };
const buttonStyle = { width: "100%", padding: "13px 16px", border: 0, borderRadius: 9, background: "#24458b", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" };
