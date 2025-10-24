"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function Hero() {
  const router = useRouter();

  const handleStartChat = () => {
    router.push("/chat");
  };

  return (
    <div className="py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance mb-6">
            Your AI Assistant,
            <br />
            <span className="text-primary">Always Ready to Help</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 text-balance">
            Experience seamless conversations with an AI that understands context,
            remembers your preferences, and provides instant, accurate responses.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" onClick={handleStartChat} className="group">
              Start chatting
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline">
              Learn more
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
