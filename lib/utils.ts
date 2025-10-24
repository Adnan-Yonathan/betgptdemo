import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export async function mockStream(
  text: string,
  onChunk: (chunk: string) => void,
  onComplete?: () => void
): Promise<void> {
  const words = text.split(' ');

  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? '' : ' ') + words[i];
    onChunk(chunk);
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 40));
  }

  onComplete?.();
}
