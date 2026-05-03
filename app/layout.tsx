import type { Metadata } from "next";
import "./globals.css";
import AutoSync from "@/components/AutoSync";

export const metadata: Metadata = {
  title: "Job Application Tracker",
  description: "Track applications, rejections, interviews, tasks, and assessments from Gmail."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="navbar">
          <div className="navbar-inner">
            <a className="brand" href="/">Job Application Tracker</a>
            <nav className="nav-links">
              <a href="/dashboard">Dashboard</a>
              <a href="/applications">Applications</a>
              <a href="/tasks">Tasks</a>
              <a href="/review">Review Inbox</a>
              <a href="/settings">Settings</a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <AutoSync />
      </body>
    </html>
  );
}
