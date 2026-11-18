export function isVerifiedGoogleEmail(profile: unknown) {
  return typeof profile === "object" && profile !== null &&
    "email_verified" in profile && profile.email_verified === true;
}
