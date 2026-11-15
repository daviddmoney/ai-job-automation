import { NextRequest,NextResponse } from "next/server";
import { auth } from "@/auth";
import { completeGmailOAuth } from "@/lib/gmail";
export const runtime="nodejs";
export async function GET(request:NextRequest){
 const session=await auth(),state=request.nextUrl.searchParams.get("state"),cookie=request.cookies.get("gmail_oauth_state")?.value,code=request.nextUrl.searchParams.get("code"),error=request.nextUrl.searchParams.get("error");
 const url=new URL("/settings/email",request.url),clear=(r:NextResponse)=>{r.cookies.set("gmail_oauth_state","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api/gmail/callback",maxAge:0});return r;};
 if(!session?.user?.id||!state||!cookie||state!==cookie||!code||error){url.searchParams.set("error",error?"google_consent_denied":"oauth_state_invalid");return clear(NextResponse.redirect(url));}
 try{await completeGmailOAuth(code,session.user.id);url.searchParams.set("connected","1");}catch{url.searchParams.set("error","gmail_connection_failed");}
 return clear(NextResponse.redirect(url));
}