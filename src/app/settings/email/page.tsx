import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { gmailStatus } from "@/lib/gmail";
import EmailSettings from "./email-settings";
export const dynamic="force-dynamic";
export default async function EmailSettingsPage({searchParams}:{searchParams:Promise<{error?:string;connected?:string}>}){
 const s=await auth();if(!s?.user?.id)redirect("/signin");
 const [status,params]=await Promise.all([gmailStatus(s.user.id),searchParams]);
 const errors:Record<string,string>={oauth_not_configured:"Gmail OAuth is not configured by the site administrator.",google_consent_denied:"Google access was not granted.",oauth_state_invalid:"The Gmail connection request expired or could not be validated.",gmail_connection_failed:"Gmail could not be connected. Please try again."};
 return <EmailSettings connected={status.connected} email={status.email} cv={status.cv?{id:status.cv.id,fileName:status.cv.fileName,sizeBytes:status.cv.sizeBytes}:null} error={params.error?errors[params.error]||"Gmail connection failed.":params.connected?"Gmail connected successfully.":null}/>;
}
