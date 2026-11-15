import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Job Automation | Your intelligent career workspace",
    template: "%s | AI Job Automation"
  },
  description: "Discover global opportunities, prepare stronger applications and manage your career journey in one multilingual, human-controlled workspace.",
  applicationName: "AI Job Automation",
  robots: { index: true, follow: true },
  themeColor: "#080b14"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
