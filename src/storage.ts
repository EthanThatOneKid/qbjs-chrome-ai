import type { ChatMessage } from "./types.ts";

export const STORAGE_KEYS = {
  msgs: "chatMessages",
  token: "trialToken",
} as const;

export function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.msgs);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveMessages(list: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.msgs, JSON.stringify(list));
  } catch {
    // ignore persistence failures
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.token);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.token, token);
  } catch {
    // ignore persistence failures
  }
}
