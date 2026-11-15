import { NextRequest,NextResponse } from "next/server";
import { auth } from "@/auth";
import { disconnectGmail } from "@/lib/gmail";
import { isSameOriginRequest } from "@/lib/request-security";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({message:"Request rejected."},{status:403});
 const s=await auth();if(!s?.user?.id)return NextResponse.redirect(new URL("/signin",request.url));
 await disconnectGmail(s.user.id);
 return NextResponse.redirect(new URL("/settings/email?disconnected=1",request.url));
}
