import type { ChatMessage } from "./types.ts";

export const STORAGE_KEYS = {
  msgs: "chatMessages",
  token: "trialToken",
  apiKey: "apiKey",
  modelPreference: "modelPreference",
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

export function getModelPreference(): "local" | "remote" {
  try {
    const pref = localStorage.getItem(STORAGE_KEYS.modelPreference);
    if (pref === "local" || pref === "remote") {
      return pref;
    }
    return "local";
  } catch {
    return "local";
  }
}

export function saveModelPreference(pref: "local" | "remote"): void {
  try {
    localStorage.setItem(STORAGE_KEYS.modelPreference, pref);
  } catch {
    // ignore persistence failures
  }
}

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.apiKey);
  } catch {
    return null;
  }
}

export function saveApiKey(apiKey: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
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
