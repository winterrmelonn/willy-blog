"use client";

import { useEffect } from "react";
import Link from "next/link";

// html[data-backend] slides the top bar up and the profile sidebar left (app/globals.css).

// Sidebar link: start the slide-out on click, while the backend page loads
export function BackendLink(props: React.ComponentProps<typeof Link>) {
  return <Link {...props} onClick={() => { document.documentElement.dataset.backend = ""; }} />;
}

// The fullscreen page: keeps the bars out while it's open, lets them slide back when it closes
export function BackendShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.backend = "";
    return () => { delete document.documentElement.dataset.backend; };
  }, []);
  return <div className="backend-page fixed inset-0 z-30 overflow-y-auto bg-white dark:bg-black">{children}</div>;
}
