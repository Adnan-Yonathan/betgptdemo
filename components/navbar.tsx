"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";

export function Navbar() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <MessageSquare className="h-6 w-6" />
            <span>ChatApp</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="outline" size="sm" asChild>
              <Link href="/chat">Log in</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
