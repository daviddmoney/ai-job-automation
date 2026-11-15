"use client";
import { useState } from "react";
type Props={connected:boolean;email:string|null;cv:{id:string;fileName:string;sizeBytes:number}|null;error?:string|null;};
export default function EmailSettings({connected,email,cv:initialCv,error}:Props){
 const [cv,setCv]=useState(initialCv),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(error||"");
 const [to,setTo]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState(""),[draftId,setDraftId]=useState("");
 async function upload(){
  if(!file)return;setBusy(true);setMessage("");
  try{const form=new FormData();form.set("file",file);const r=await fetch("/api/cv",{method:"POST",body:form});const d=await r.json();if(!r.ok)throw new Error(d.message||"Upload failed.");setCv(d.cv);setFile(null);setMessage("CV uploaded and encrypted. It will be attached automatically to every new or updated Gmail draft.");}
  catch(e){setMessage(e instanceof Error?e.message:"Upload failed.");}finally{setBusy(false);}
 }
 async function saveDraft(update:boolean){
  if(!to||!subject||!body){setMessage("Enter the recipient, subject and message first.");return;}
  if(update&&!draftId){setMessage("Enter or create a Gmail draft ID before updating.");return;}
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/gmail/drafts",{method:update?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({to,subject,body,...(update?{draftId}:{})})});
   const d=await r.json();if(!r.ok)throw new Error(d.message||"Gmail draft operation failed.");
   setDraftId(d.draftId);setMessage(update?"Draft updated. Gmail confirmed that the PDF CV is attached.":"Draft created. Gmail confirmed that the PDF CV is attached.");
  }catch(e){setMessage(e instanceof Error?e.message:"Gmail draft operation failed.");}finally{setBusy(false);}
 }
 async function sendDraft(){
  if(!draftId||!window.confirm("Send this Gmail draft now? The saved PDF CV must be attached."))return;
  setBusy(true);setMessage("");
  try{const r=await fetch("/api/gmail/drafts/send",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({draftId,confirmSend:true})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Gmail send failed.");setMessage("Gmail confirmed the email was sent. Message ID: "+d.messageId);setDraftId("");}
  catch(e){setMessage(e instanceof Error?e.message:"Gmail send failed.");}finally{setBusy(false);}
 }
 return <main style={{maxWidth:760,margin:"0 auto",padding:"48px 24px"}}>
  <a href="/dashboard" style={{color:"#3657a7"}}>← Dashboard</a><h1 style={{fontSize:34}}>Email and CV settings</h1>
  <p style={{color:"#596579",lineHeight:1.7}}>Connect Gmail and store your CV securely. New drafts and every draft update attach the saved PDF automatically. Sending is separate and requires your confirmation.</p>
  <section style={card}><h2>Gmail connection</h2>{connected?<><p>Connected as <strong>{email}</strong></p><form action="/api/gmail/disconnect" method="post"><button style={button} type="submit">Disconnect Gmail</button></form></>:<><p>Gmail is not connected.</p><a href="/api/gmail/connect" style={link}>Connect Gmail securely →</a></>}</section>
  <section style={card}><h2>Primary CV</h2>{cv?<p><strong>{cv.fileName}</strong> · {(cv.sizeBytes/1024).toFixed(0)} KB</p>:<p>No CV uploaded yet.</p>}
   <label style={{display:"block",margin:"14px 0 8px"}}>Upload PDF CV (maximum 8 MB)</label><input type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/>
   <p><button style={button} disabled={!file||busy} onClick={upload}>{busy?"Uploading…":cv?"Replace CV":"Upload CV"}</button></p>
  </section>
  {connected&&cv&&<section style={card}><h2>Compose application email</h2><p style={{color:"#596579"}}>The primary CV shown above is attached automatically. Creating or updating a draft does not send it.</p>
   <label style={fieldLabel}>Recipient email</label><input style={field} type="email" value={to} onChange={e=>setTo(e.target.value)} placeholder="recruitment@example.com"/>
   <label style={fieldLabel}>Subject</label><input style={field} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Application for [Position]"/>
   <label style={fieldLabel}>Message</label><textarea style={{...field,minHeight:150,resize:"vertical"}} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your application email here."/>
   <label style={fieldLabel}>Gmail draft ID (filled after creation; paste an ID to update an existing draft)</label><input style={field} value={draftId} onChange={e=>setDraftId(e.target.value)} placeholder="Gmail draft ID"/>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
    <button style={button} disabled={busy} onClick={()=>saveDraft(false)}>{busy?"Working…":"Create draft + attach CV"}</button>
    <button style={secondaryButton} disabled={busy||!draftId} onClick={()=>saveDraft(true)}>Update draft + reattach CV</button>
    <button style={sendButton} disabled={busy||!draftId} onClick={sendDraft}>Send confirmed draft</button>
   </div>
  </section>}
  {message&&<p role="status" style={{padding:12,background:"#f2f5fa",borderRadius:8,overflowWrap:"anywhere"}}>{message}</p>}
 </main>;
}
const card={border:"1px solid #e5e9f0",borderRadius:14,padding:20,marginTop:18};
const button={background:"#24458b",color:"white",border:0,borderRadius:8,padding:"10px 16px"};
const secondaryButton={background:"#e8edf6",color:"#24458b",border:0,borderRadius:8,padding:"10px 16px"};
const sendButton={background:"#176b45",color:"white",border:0,borderRadius:8,padding:"10px 16px"};
const link={display:"inline-block",background:"#24458b",color:"white",borderRadius:8,padding:"10px 16px",textDecoration:"none"};
const fieldLabel={display:"block",fontWeight:600,margin:"12px 0 6px"};
const field={boxSizing:"border-box" as const,width:"100%",border:"1px solid #cbd3df",borderRadius:8,padding:10,font:"inherit"};
