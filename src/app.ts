import { compileQbjsUrl } from "./qbjs.ts";

interface ChatMessage {
  id: string;
  role: "user" | "system";
  text: string;
  ts: number;
}

const STORAGE_KEYS = {
  msgs: "chatMessages",
  token: "trialToken",
} as const;

const SYSTEM_REPLY_CODE = 'Print "Hello world"';

function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.token);
  } catch {
    return null;
  }
}

function ensureToken(): string {
  let token = getToken();
  if (!token) {
    // Uses window.prompt per MDN guidance: https://developer.mozilla.org/en-US/docs/Web/API/Window/prompt
    token = globalThis.prompt(
      "Enter your trial token (get one at: https://developer.chrome.com/origintrials/#/view_trial/2533837740349325313):",
    )?.trim() || "";
    if (token) {
      try {
        localStorage.setItem(STORAGE_KEYS.token, token);
      } catch { /* ignore */ }
    }
  }
  return token;
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.msgs);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(list: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.msgs, JSON.stringify(list));
  } catch {
    // ignore persistence failures
  }
}

function renderMessage(
  li: HTMLLIElement,
  message: ChatMessage | { role: "loading" },
): void {
  li.setAttribute("data-role", message.role);
  if (message.role === "loading") {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    li.appendChild(spinner);
    const text = document.createTextNode("Thinking...");
    li.appendChild(text);
  } else if ((message as ChatMessage).role === "system") {
    const wrapper = document.createElement("div");
    wrapper.className = "iframe-wrapper";
    const iframe = document.createElement("iframe");
    iframe.width = "656";
    iframe.height = "416";
    const code = (message as ChatMessage).text || SYSTEM_REPLY_CODE;
    iframe.src = compileQbjsUrl(code, "auto");
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("title", "QBJS preview");
    wrapper.appendChild(iframe);
    li.appendChild(wrapper);
  } else {
    li.textContent = (message as ChatMessage).text;
  }
}

function render(list: ChatMessage[]): void {
  const listEl = document.getElementById("messages") as HTMLOListElement | null;
  if (!listEl) return;
  listEl.innerHTML = "";
  for (const m of list) {
    const li = document.createElement("li");
    renderMessage(li, m);
    listEl.appendChild(li);
  }
  listEl.scrollTop = listEl.scrollHeight;
}

function addLoadingMessage(): HTMLLIElement {
  const listEl = document.getElementById("messages") as HTMLOListElement | null;
  if (!listEl) throw new Error("Messages list not found");
  const li = document.createElement("li");
  renderMessage(li, { role: "loading" });
  listEl.appendChild(li);
  listEl.scrollTop = listEl.scrollHeight;
  return li;
}

function setup(): void {
  const form = document.getElementById("chat-form") as HTMLFormElement | null;
  const input = document.getElementById("input") as HTMLTextAreaElement | null;
  const changeBtn = document.getElementById("change-token") as
    | HTMLButtonElement
    | null;
  const clearBtn = document.getElementById("clear-messages") as
    | HTMLButtonElement
    | null;

  ensureToken();

  let messages = loadMessages();
  render(messages);

  if (form && input) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        ts: Date.now(),
      };
      messages.push(userMsg);
      saveMessages(messages);
      render(messages);

      const loadingLi = addLoadingMessage();

      setTimeout(() => {
        const systemMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          text: SYSTEM_REPLY_CODE,
          ts: Date.now(),
        };
        messages.push(systemMsg);
        saveMessages(messages);

        loadingLi.setAttribute("data-role", "system");
        loadingLi.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.className = "iframe-wrapper";
        const iframe = document.createElement("iframe");
        iframe.width = "656";
        iframe.height = "416";
        iframe.src = compileQbjsUrl(systemMsg.text, "auto");
        iframe.setAttribute("loading", "lazy");
        iframe.setAttribute("referrerpolicy", "no-referrer");
        iframe.setAttribute("scrolling", "no");
        iframe.setAttribute("title", "QBJS preview");
        wrapper.appendChild(iframe);
        loadingLi.appendChild(wrapper);

        const listEl = document.getElementById("messages") as
          | HTMLOListElement
          | null;
        if (listEl) {
          listEl.scrollTop = listEl.scrollHeight;
        }
      }, 2000);

      input.value = "";
      input.focus();
    });
  }

  if (changeBtn) {
    changeBtn.addEventListener("click", () => {
      const existing = getToken() || "";
      const updated = globalThis.prompt(
        "Update your trial token (learn more: https://developer.chrome.com/origintrials/#/view_trial/2533837740349325313):",
        existing,
      )?.trim() || "";
      if (updated) {
        try {
          localStorage.setItem(STORAGE_KEYS.token, updated);
        } catch { /* ignore */ }
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      messages = [];
      try {
        localStorage.removeItem(STORAGE_KEYS.msgs);
      } catch { /* ignore */ }
      render(messages);
    });
  }
}

document.addEventListener("DOMContentLoaded", setup);
