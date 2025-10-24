"use client";

import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { ValueCards } from "@/components/value-cards";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="min-h-screen flex flex-col"
    >
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ValueCards />
      </main>
      <Footer />
    </motion.div>
  );
}
