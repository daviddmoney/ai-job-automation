"use client";
import { useState } from "react";
type Props={connected:boolean;email:string|null;cv:{id:string;fileName:string;sizeBytes:number}|null;error?:string|null;};
export default function EmailSettings({connected,email,cv:initialCv,error}:Props){
 const [cv,setCv]=useState(initialCv),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(error||"");
 async function upload(){
  if(!file)return;setBusy(true);setMessage("");
  try{const form=new FormData();form.set("file",file);const r=await fetch("/api/cv",{method:"POST",body:form});const d=await r.json();if(!r.ok)throw new Error(d.message||"Upload failed.");setCv(d.cv);setFile(null);setMessage("CV uploaded. It will be attached automatically to every new or updated Gmail draft.");}
  catch(e){setMessage(e instanceof Error?e.message:"Upload failed.");}finally{setBusy(false);}
 }
 return <main style={{maxWidth:760,margin:"0 auto",padding:"48px 24px"}}>
  <a href="/dashboard" style={{color:"#3657a7"}}>← Dashboard</a><h1 style={{fontSize:34}}>Email and CV settings</h1>
  <p style={{color:"#596579",lineHeight:1.7}}>Connect your Gmail account and store your CV securely. Draft creation and updates attach the saved PDF automatically. Sending remains a separate, explicitly confirmed action.</p>
  <section style={card}><h2>Gmail connection</h2>{connected?<><p>Connected as <strong>{email}</strong></p><form action="/api/gmail/disconnect" method="post"><button style={button} type="submit">Disconnect Gmail</button></form></>:<><p>Gmail is not connected.</p><a href="/api/gmail/connect" style={link}>Connect Gmail securely →</a></>}</section>
  <section style={card}><h2>Primary CV</h2>{cv?<p><strong>{cv.fileName}</strong> · {(cv.sizeBytes/1024).toFixed(0)} KB</p>:<p>No CV uploaded yet.</p>}
   <label style={{display:"block",margin:"14px 0 8px"}}>Upload PDF CV (maximum 8 MB)</label><input type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/>
   <p><button style={button} disabled={!file||busy} onClick={upload}>{busy?"Uploading…":cv?"Replace CV":"Upload CV"}</button></p>
  </section>
  {message&&<p role="status" style={{padding:12,background:"#f2f5fa",borderRadius:8}}>{message}</p>}
 </main>;
}
const card={border:"1px solid #e5e9f0",borderRadius:14,padding:20,marginTop:18};
const button={background:"#24458b",color:"white",border:0,borderRadius:8,padding:"10px 16px",cursor:"pointer"};
const link={display:"inline-block",background:"#24458b",color:"white",borderRadius:8,padding:"10px 16px",textDecoration:"none"};
