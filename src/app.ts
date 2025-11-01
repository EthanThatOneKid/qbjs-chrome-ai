import type { ChatMessage } from "./types.ts";
import { compileQbjsUrl } from "./qbjs.ts";
import { experimentMockReply, SYSTEM_REPLY_CODE } from "./config.ts";
import {
  getToken,
  loadMessages,
  saveMessages,
  saveToken,
  STORAGE_KEYS,
} from "./storage.ts";
import { updateOriginTrialMetaTag } from "./origin-trial.ts";
import { addLoadingMessage, render } from "./render.ts";
import {
  codeResponseSchema,
  destroySession,
  initializeSession,
} from "./session.ts";

function setup(): void {
  const form = document.getElementById("chat-form") as HTMLFormElement | null;
  const input = document.getElementById("input") as HTMLTextAreaElement | null;
  const clearBtn = document.getElementById("clear-messages") as
    | HTMLButtonElement
    | null;
  const changeTokenBtn = document.getElementById("change-token") as
    | HTMLButtonElement
    | null;

  // Load and set token from storage
  const savedToken = getToken();
  if (savedToken) {
    updateOriginTrialMetaTag(savedToken);
  }

  let messages = loadMessages();
  render(messages);

  if (form && input) {
    form.addEventListener("submit", async (e) => {
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
      input.value = "";
      input.focus();

      try {
        let code: string;

        if (experimentMockReply) {
          // Mock response mode
          await new Promise((resolve) => setTimeout(resolve, 2000));
          code = SYSTEM_REPLY_CODE;
        } else {
          // Real API mode
          // Pass conversation history excluding the current user message we just added
          const conversationHistory = messages.slice(0, -1);
          const currentSession = await initializeSession(
            text,
            conversationHistory,
          );
          try {
            const response = await currentSession.prompt(text, {
              responseConstraint: codeResponseSchema,
            });
            const parsed = JSON.parse(response);
            if (typeof parsed.code !== "string") {
              throw new Error("Invalid response format: missing code field");
            }
            code = parsed.code;
          } finally {
            // Clean up session after use since we create new sessions per request
            await destroySession(currentSession);
          }
        }

        const systemMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          text: code,
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

        const link = document.createElement("a");
        link.href = compileQbjsUrl(systemMsg.text);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open in QBJS IDE";
        loadingLi.appendChild(link);

        const listEl = document.getElementById("messages") as
          | HTMLOListElement
          | null;
        if (listEl) {
          listEl.scrollTop = listEl.scrollHeight;
        }
      } catch (error) {
        // Handle errors
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "error",
          text: error instanceof Error ? error.message : String(error),
          ts: Date.now(),
        };
        messages.push(errorMsg);
        saveMessages(messages);

        loadingLi.setAttribute("data-role", "error");
        loadingLi.innerHTML = "";
        loadingLi.textContent = `Error: ${errorMsg.text}`;

        const listEl = document.getElementById("messages") as
          | HTMLOListElement
          | null;
        if (listEl) {
          listEl.scrollTop = listEl.scrollHeight;
        }
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

  if (changeTokenBtn) {
    changeTokenBtn.addEventListener("click", () => {
      const existing = getToken() || "";
      const updated = globalThis.prompt(
        "Enter your origin trial token (get one at: https://developer.chrome.com/origintrials/#/view_trial/2533837740349325313):",
        existing,
      )?.trim() || "";
      if (updated) {
        saveToken(updated);
        updateOriginTrialMetaTag(updated);
        alert(
          "Trial token updated. Please reload the page for changes to take effect.",
        );
      } else if (existing) {
        // User cleared the token
        saveToken("");
        updateOriginTrialMetaTag(null);
        alert(
          "Trial token removed. Please reload the page for changes to take effect.",
        );
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", setup);

// Note: Sessions are now created per request and cleaned up immediately after use.
// These cleanup handlers are kept for any edge cases but are no longer critical.
globalThis.addEventListener("beforeunload", () => {
  // Sessions are cleaned up per request, so no global session to destroy
});

globalThis.addEventListener("pagehide", () => {
  // Sessions are cleaned up per request, so no global session to destroy
});
