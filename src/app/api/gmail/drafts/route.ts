import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createGmailDraft,updateGmailDraft } from "@/lib/gmail";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
export const runtime="nodejs";
const schema=z.object({to:z.string().email().max(254),subject:z.string().min(1).max(250),body:z.string().min(1).max(50000),cvId:z.string().optional()});
export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({message:"Request rejected."},{status:403});
 const s=await auth();if(!s?.user?.id)return NextResponse.json({message:"Sign in required."},{status:401});
 try{const key=requestRateLimitKey(request,"gmail-draft-create",s.user.id);if(!(await consumeRateLimit(key,10,60)))return NextResponse.json({message:"Too many draft requests. Wait before retrying."},{status:429});}catch{return NextResponse.json({message:"Security service unavailable."},{status:503});}
 const parsed=await readLimitedJson(request,64*1024);if(!parsed.ok)return NextResponse.json({message:parsed.message},{status:parsed.status});
 const p=schema.safeParse(parsed.data);if(!p.success)return NextResponse.json({message:"Invalid draft details."},{status:400});
 try{const d=await createGmailDraft(s.user.id,p.data);if(!d.id||!d.message?.id)return NextResponse.json({message:"Gmail did not confirm draft creation."},{status:502});
 await prisma.auditEvent.create({data:{userId:s.user.id,action:"GMAIL_DRAFT_CREATED",resource:"GmailDraft",resourceId:d.id}});
 return NextResponse.json({message:"Draft created with PDF CV attached.",draftId:d.id,messageId:d.message.id},{status:201});}
 catch(e){const m=e instanceof Error?e.message:"";return NextResponse.json({message:m==="GMAIL_NOT_CONNECTED"?"Connect Gmail first.":m==="CV_NOT_UPLOADED"?"Upload your CV first.":"Gmail could not create the draft."},{status:m==="GMAIL_NOT_CONNECTED"||m==="CV_NOT_UPLOADED"?409:502});}
}
export async function PATCH(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({message:"Request rejected."},{status:403});
 const s=await auth();if(!s?.user?.id)return NextResponse.json({message:"Sign in required."},{status:401});
 try{const key=requestRateLimitKey(request,"gmail-draft-update",s.user.id);if(!(await consumeRateLimit(key,10,60)))return NextResponse.json({message:"Too many draft requests. Wait before retrying."},{status:429});}catch{return NextResponse.json({message:"Security service unavailable."},{status:503});}
 const parsed=await readLimitedJson(request,64*1024);if(!parsed.ok)return NextResponse.json({message:parsed.message},{status:parsed.status});
 const p=z.object({draftId:z.string().min(1).max(200)}).merge(schema).safeParse(parsed.data);
 if(!p.success)return NextResponse.json({message:"Invalid draft update."},{status:400});
 try{const {draftId,...input}=p.data,d=await updateGmailDraft(s.user.id,draftId,input);if(!d.id||!d.message?.id)return NextResponse.json({message:"Gmail did not confirm draft update."},{status:502});
 await prisma.auditEvent.create({data:{userId:s.user.id,action:"GMAIL_DRAFT_UPDATED",resource:"GmailDraft",resourceId:d.id}});
 return NextResponse.json({message:"Draft updated and PDF CV reattached.",draftId:d.id,messageId:d.message.id});}
 catch{return NextResponse.json({message:"Gmail could not update this draft. Confirm it still exists and retry."},{status:502});}
}