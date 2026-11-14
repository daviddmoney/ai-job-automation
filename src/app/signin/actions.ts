"use server";

import { signIn } from "@/auth";

export async function credentialsSignIn(formData: FormData) {
  await signIn("credentials", {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    secondFactorMethod: String(formData.get("secondFactorMethod") ?? ""),
    secondFactorCode: String(formData.get("secondFactorCode") ?? ""),
    redirectTo: "/dashboard"
  });
}

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/dashboard" });
}
