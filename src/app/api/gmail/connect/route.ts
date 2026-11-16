import { NextRequest,NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { gmailAuthorizationUrl } from "@/lib/gmail";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
export const runtime="nodejs";
export async function GET(request:NextRequest){
 const session=await auth(); if(!session?.user?.id)return NextResponse.redirect(new URL("/signin",request.url));
 try{const key=requestRateLimitKey(request,"gmail-connect",session.user.id);if(!(await consumeRateLimit(key,10,600)))return NextResponse.redirect(new URL("/settings/email?error=rate_limited",request.url));}catch{return NextResponse.redirect(new URL("/settings/email?error=security_unavailable",request.url));}
 try{const state=randomBytes(32).toString("hex"),response=NextResponse.redirect(gmailAuthorizationUrl(state));response.cookies.set("gmail_oauth_state",state+":"+session.user.id,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api/gmail/callback",maxAge:600});return response;}
 catch{return NextResponse.redirect(new URL("/settings/email?error=oauth_not_configured",request.url));}
}