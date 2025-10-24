"use client";

import { motion } from "framer-motion";
import { Zap, Brain, Share2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const cards = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Get instant responses to your questions with our optimized AI engine that delivers answers in milliseconds.",
  },
  {
    icon: Brain,
    title: "Context Aware",
    description: "Our AI remembers your conversation history and preferences, providing personalized and relevant responses.",
  },
  {
    icon: Share2,
    title: "Easy Sharing",
    description: "Share conversations with colleagues through simple links, making collaboration effortless and efficient.",
  },
];

export function ValueCards() {
  return (
    <div className="py-20 bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {cards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <card.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{card.description}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
