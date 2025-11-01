export interface ChatMessage {
  id: string;
  role: "user" | "system" | "error";
  text: string;
  ts: number;
}

export interface FewShotSample {
  description: string;
  code: string;
}
