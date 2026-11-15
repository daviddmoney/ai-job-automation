import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendGmailDraft } from "@/lib/gmail";
import { isSameOriginRequest } from "@/lib/request-security";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({message:"Request rejected."},{status:403});
 const s=await auth();if(!s?.user?.id)return NextResponse.json({message:"Sign in required."},{status:401});
 const p=z.object({draftId:z.string().min(1).max(200),confirmSend:z.literal(true)}).safeParse(await request.json().catch(()=>null));
 if(!p.success)return NextResponse.json({message:"Explicit send confirmation is required."},{status:400});
 try{const result=await sendGmailDraft(s.user.id,p.data.draftId);if(!result.id)return NextResponse.json({message:"Gmail did not confirm sending."},{status:502});
 await prisma.auditEvent.create({data:{userId:s.user.id,action:"GMAIL_DRAFT_SENT",resource:"GmailMessage",resourceId:result.id}});
 return NextResponse.json({message:"Gmail confirmed the message was sent.",messageId:result.id,threadId:result.threadId});}
 catch{return NextResponse.json({message:"Gmail could not send this draft. Check the draft and connection."},{status:502});}
}