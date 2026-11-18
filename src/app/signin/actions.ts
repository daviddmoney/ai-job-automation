"use server";

import { signIn } from "@/auth";
import { headers } from "next/headers";
import { consumeOAuthInitiationEndpointLimit } from "@/lib/rate-limit";

export type SignInActionState = { error: string };

export async function credentialsSignIn(_previousState: SignInActionState, formData: FormData): Promise<SignInActionState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      secondFactorMethod: String(formData.get("secondFactorMethod") ?? ""),
      secondFactorCode: String(formData.get("secondFactorCode") ?? ""),
      redirectTo: "/dashboard"
    });
    return { error: "" };
  } catch (error) {
    const authError = error as { type?: unknown; code?: unknown };
    if (authError?.type === "CredentialsSignin" && authError.code === "rate_limited") {
      return { error: "Too many sign-in attempts. Please wait before trying again." };
    }
    if (authError?.type === "CredentialsSignin") {
      return { error: "Sign-in failed. Check your details and try again." };
    }
    throw error;
  }
}

export async function googleSignIn() {
  const requestHeaders = await headers();
  const request = new Request("https://internal.invalid/api/auth/signin/google", { headers: requestHeaders });
  const limit = await consumeOAuthInitiationEndpointLimit(request);
  if (!limit.identityVerified) throw new Error("Sign-in is temporarily unavailable.");
  if (!limit.allowed) throw new Error("Too many sign-in attempts. Please wait before trying again.");
  await signIn("google", { redirectTo: "/dashboard" });
}
