import { NextRequest,NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { encryptTotpSecret } from "@/lib/two-factor";
export const runtime="nodejs";
const MAX=8*1024*1024;
export async function GET(){
 const s=await auth();if(!s?.user?.id)return NextResponse.json({message:"Sign in required."},{status:401});
 const cv=await prisma.cvDocument.findFirst({where:{userId:s.user.id,isPrimary:true},select:{id:true,fileName:true,mimeType:true,sizeBytes:true,updatedAt:true},orderBy:{updatedAt:"desc"}});
 return NextResponse.json({cv});
}
export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({message:"Request rejected."},{status:403});
 const s=await auth();if(!s?.user?.id)return NextResponse.json({message:"Sign in required."},{status:401});
 const form=await request.formData().catch(()=>null),file=form?.get("file");
 if(!(file instanceof File))return NextResponse.json({message:"Choose a PDF CV."},{status:400});
 if(file.size<1||file.size>MAX||file.type!=="application/pdf"||!file.name.toLowerCase().endsWith(".pdf"))return NextResponse.json({message:"CV must be a PDF no larger than 8 MB."},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer());if(bytes.subarray(0,5).toString("ascii")!=="%PDF-")return NextResponse.json({message:"Invalid PDF file."},{status:400});
 const cv=await prisma.$transaction(async tx=>{await tx.cvDocument.updateMany({where:{userId:s.user.id,isPrimary:true},data:{isPrimary:false}});return tx.cvDocument.create({data:{userId:s.user.id,fileName:file.name.replace(/[\\/\r\n]/g,"_").slice(0,180),mimeType:"application/pdf",sizeBytes:bytes.length,content:Buffer.from(encryptTotpSecret(bytes.toString("base64")),"utf8"),isPrimary:true},select:{id:true,fileName:true,sizeBytes:true}});});
 await prisma.auditEvent.create({data:{userId:s.user.id,action:"CV_UPLOADED",resource:"CvDocument",resourceId:cv.id}});
 return NextResponse.json({message:"CV uploaded privately.",cv},{status:201});
}