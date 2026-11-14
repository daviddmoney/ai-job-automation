import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "STAFF";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
  interface User { role?: "USER" | "STAFF"; }
}

declare module "next-auth/jwt" {
  interface JWT { role?: "USER" | "STAFF"; }
}
