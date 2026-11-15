import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/two-factor";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
function config() {
 const clientId=process.env.GOOGLE_GMAIL_CLIENT_ID, clientSecret=process.env.GOOGLE_GMAIL_CLIENT_SECRET, redirectUri=process.env.GOOGLE_GMAIL_REDIRECT_URI;
 if(!clientId||!clientSecret||!redirectUri) throw new Error("GMAIL_OAUTH_NOT_CONFIGURED");
 return {clientId,clientSecret,redirectUri};
}
export function gmailAuthorizationUrl(state:string) {
 const c=config(), u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 u.search=new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirectUri,response_type:"code",scope:"https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",access_type:"offline",prompt:"consent",include_granted_scopes:"true",state}).toString();
 return u.toString();
}
async function tokenRequest(params:URLSearchParams) {
 const c=config(), r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({...Object.fromEntries(params),client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirectUri}),cache:"no-store"});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.access_token) throw new Error("GMAIL_TOKEN_EXCHANGE_FAILED");
 return d as {access_token:string;refresh_token?:string;expires_in:number;scope?:string};
}
export async function completeGmailOAuth(code:string,userId:string) {
 const t=await tokenRequest(new URLSearchParams({code,grant_type:"authorization_code"}));
 if(!t.refresh_token) throw new Error("GMAIL_REFRESH_TOKEN_MISSING");
 const granted=new Set((t.scope||"").split(" "));
 if(!granted.has("https://www.googleapis.com/auth/gmail.compose")||!granted.has("https://www.googleapis.com/auth/gmail.send")) throw new Error("GMAIL_REQUIRED_SCOPES_NOT_GRANTED");
 const r=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{authorization:"Bearer "+t.access_token},cache:"no-store"}), p=await r.json().catch(()=>({}));
 if(!r.ok||typeof p.email!=="string") throw new Error("GMAIL_PROFILE_LOOKUP_FAILED");
 await prisma.gmailConnection.upsert({where:{userId},create:{userId,googleEmail:p.email,accessTokenCipher:encryptTotpSecret(t.access_token),refreshTokenCipher:encryptTotpSecret(t.refresh_token),expiresAt:new Date(Date.now()+t.expires_in*1000),scopes:(t.scope||"").split(" ").filter(Boolean)},update:{googleEmail:p.email,accessTokenCipher:encryptTotpSecret(t.access_token),refreshTokenCipher:encryptTotpSecret(t.refresh_token),expiresAt:new Date(Date.now()+t.expires_in*1000),scopes:(t.scope||"").split(" ").filter(Boolean)}});
}
async function getToken(userId:string) {
 const c=await prisma.gmailConnection.findUnique({where:{userId}});
 if(!c) throw new Error("GMAIL_NOT_CONNECTED");
 if(c.expiresAt.getTime()>Date.now()+60000) return {token:decryptTotpSecret(c.accessTokenCipher),email:c.googleEmail};
 const cfg=config(), refresh=decryptTotpSecret(c.refreshTokenCipher);
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,refresh_token:refresh,grant_type:"refresh_token"}),cache:"no-store"});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.access_token) throw new Error("GMAIL_TOKEN_REFRESH_FAILED");
 await prisma.gmailConnection.update({where:{userId},data:{accessTokenCipher:encryptTotpSecret(d.access_token),expiresAt:new Date(Date.now()+Number(d.expires_in||3600)*1000)}});
 return {token:d.access_token as string,email:c.googleEmail};
}
export async function disconnectGmail(userId:string) {
 const c=await prisma.gmailConnection.findUnique({where:{userId}});
 if(c){try{await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token:decryptTotpSecret(c.refreshTokenCipher)})});}catch{} await prisma.gmailConnection.delete({where:{userId}});}
}
function b64url(b:Buffer){return b.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function clean(s:string){return s.replace(/[\r\n]/g," ").trim();}
export function buildMimeMessage(x:{from:string;to:string;subject:string;body:string;attachment:{fileName:string;mimeType:string;content:Buffer}}) {
 const boundary="ajob_"+randomBytes(18).toString("hex"), filename=clean(x.attachment.fileName).replace(/["\\]/g,"_");
 const lines=["From: "+clean(x.from),"To: "+clean(x.to),"Subject: "+clean(x.subject),"MIME-Version: 1.0",'Content-Type: multipart/mixed; boundary="'+boundary+'"',"","--"+boundary,'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: 8bit","",x.body,"--"+boundary,"Content-Type: "+clean(x.attachment.mimeType)+'; name="'+filename+'"',"Content-Transfer-Encoding: base64",'Content-Disposition: attachment; filename="'+filename+'"',"",x.attachment.content.toString("base64").replace(/.{1,76}/g,"$&\r\n").trimEnd(),"--"+boundary+"--",""];
 return b64url(Buffer.from(lines.join("\r\n"),"utf8"));
}
async function api(userId:string,path:string,method:string,body?:unknown) {
 const t=await getToken(userId), r=await fetch(API+"/"+path,{method,headers:{authorization:"Bearer "+t.token,...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"});
 const d=await r.json().catch(()=>({}));
 if(!r.ok) throw new Error(typeof d.error?.message==="string"?d.error.message:"GMAIL_API_"+r.status);
 return d;
}
async function attachment(userId:string,cvId?:string) {
 const cv=await prisma.cvDocument.findFirst({where:{userId,...(cvId?{id:cvId}:{isPrimary:true})},orderBy:{updatedAt:"desc"}});
 if(!cv) throw new Error("CV_NOT_UPLOADED");
 if(cv.mimeType!=="application/pdf"||!cv.fileName.toLowerCase().endsWith(".pdf")) throw new Error("CV_MUST_BE_PDF");
 return {fileName:cv.fileName,mimeType:cv.mimeType,content:Buffer.from(decryptTotpSecret(Buffer.from(cv.content).toString("utf8")),"base64")};
}
async function verifyDraftHasPdf(userId:string,draftId:string) {
 const draft=await api(userId,"drafts/"+encodeURIComponent(draftId)+"?format=full","GET");
 const walk=(part:any):boolean=>Boolean(part?.filename&&String(part.filename).toLowerCase().endsWith(".pdf")&&Number(part.body?.size)>0)||(Array.isArray(part?.parts)&&part.parts.some(walk));
 if(!walk(draft.message?.payload)) throw new Error("GMAIL_DRAFT_ATTACHMENT_VERIFICATION_FAILED");
 return draft;
}
export async function createGmailDraft(userId:string,x:{to:string;subject:string;body:string;cvId?:string}) {
 const t=await getToken(userId), a=await attachment(userId,x.cvId), raw=buildMimeMessage({from:t.email,to:x.to,subject:x.subject,body:x.body,attachment:a});
 const created=await api(userId,"drafts","POST",{message:{raw}});
 if(!created.id) throw new Error("GMAIL_DRAFT_CREATE_FAILED");
 await verifyDraftHasPdf(userId,created.id);
 return created;
}
export async function updateGmailDraft(userId:string,draftId:string,x:{to:string;subject:string;body:string;cvId?:string}) {
 const t=await getToken(userId), a=await attachment(userId,x.cvId), raw=buildMimeMessage({from:t.email,to:x.to,subject:x.subject,body:x.body,attachment:a});
 const updated=await api(userId,"drafts/"+encodeURIComponent(draftId),"PUT",{id:draftId,message:{raw}});
 if(!updated.id) throw new Error("GMAIL_DRAFT_UPDATE_FAILED");
 await verifyDraftHasPdf(userId,draftId);
 return updated;
}
export async function sendGmailDraft(userId:string,draftId:string) {
 await verifyDraftHasPdf(userId,draftId);
 return api(userId,"drafts/send","POST",{id:draftId});
}
export async function gmailStatus(userId:string) {
 const [c,cv]=await Promise.all([prisma.gmailConnection.findUnique({where:{userId},select:{googleEmail:true,scopes:true}}),prisma.cvDocument.findFirst({where:{userId,isPrimary:true},select:{id:true,fileName:true,sizeBytes:true,updatedAt:true},orderBy:{updatedAt:"desc"}})]);
 return {connected:Boolean(c),email:c?.googleEmail??null,cv:cv??null};
}
