import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function decodeBase64(b64: string): string {
  try {
    return atob(b64);
  } catch {
    return '[Binary data]';
  }
}

export function encodeBase64(str: string): string {
  return btoa(str);
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'text-green-500',
    POST: 'text-blue-500',
    PUT: 'text-yellow-500',
    PATCH: 'text-orange-500',
    DELETE: 'text-red-500',
    OPTIONS: 'text-gray-500',
    HEAD: 'text-purple-500',
  };
  return colors[method] || 'text-gray-400';
}

export function getStatusColor(status: number | undefined): string {
  if (!status) return 'text-gray-400';
  if (status < 200) return 'text-gray-400';
  if (status < 300) return 'text-green-500';
  if (status < 400) return 'text-blue-500';
  if (status < 500) return 'text-yellow-500';
  return 'text-red-500';
}

export function tryParseJson(str: string): object | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function formatJson(obj: object): string {
  return JSON.stringify(obj, null, 2);
}
