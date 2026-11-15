import { NextRequest,NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { gmailAuthorizationUrl } from "@/lib/gmail";
export const runtime="nodejs";
export async function GET(request:NextRequest){
 const session=await auth(); if(!session?.user?.id)return NextResponse.redirect(new URL("/signin",request.url));
 try{const state=randomBytes(32).toString("hex"),response=NextResponse.redirect(gmailAuthorizationUrl(state));response.cookies.set("gmail_oauth_state",state,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api/gmail/callback",maxAge:600});return response;}
 catch{return NextResponse.redirect(new URL("/settings/email?error=oauth_not_configured",request.url));}
}