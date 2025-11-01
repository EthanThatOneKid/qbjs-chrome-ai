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
import type { FewShotSample } from "./types.ts";
import fewShotSamples from "./samples.json" with { type: "json" };

/**
 * Get 4 random samples for suggestions
 */
function getRandomSuggestions(count: number = 4): FewShotSample[] {
  const samples = fewShotSamples as FewShotSample[];
  const shuffled = [...samples].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Add sample directly to message history without AI generation
 */
function addSampleToHistory(
  sample: FewShotSample,
  messages: ChatMessage[],
): ChatMessage[] {
  // Add user message with description
  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    text: sample.description,
    ts: Date.now(),
  };
  messages.push(userMsg);

  // Add system message with code directly
  const systemMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "system",
    text: sample.code,
    ts: Date.now(),
  };
  messages.push(systemMsg);

  saveMessages(messages);
  render(messages);

  return messages;
}

/**
 * Render suggestion prompts in a 2x2 grid when there are no messages
 */
function renderSuggestions(
  messages: ChatMessage[],
  onSampleSelect: (sample: FewShotSample) => void,
): void {
  const suggestionsContainer = document.getElementById(
    "suggestions-container",
  ) as HTMLDivElement | null;
  if (!suggestionsContainer) return;

  if (messages.length === 0) {
    const suggestions = getRandomSuggestions(4);
    suggestionsContainer.innerHTML = "";
    suggestionsContainer.style.display = "grid";
    suggestionsContainer.style.gridTemplateColumns = "1fr 1fr";
    suggestionsContainer.style.gap = "0.75rem";

    suggestions.forEach((sample) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-button";
      button.textContent = sample.description;
      button.addEventListener("click", () => {
        onSampleSelect(sample);
      });
      suggestionsContainer.appendChild(button);
    });
  } else {
    suggestionsContainer.innerHTML = "";
    suggestionsContainer.style.display = "none";
  }
}

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
  
  // Create callback that updates messages and re-renders suggestions
  const handleSampleSelect = (sample: FewShotSample) => {
    messages = addSampleToHistory(sample, messages);
    renderSuggestions(messages, handleSampleSelect);
  };
  
  render(messages);
  renderSuggestions(messages, handleSampleSelect);

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
      renderSuggestions(messages, handleSampleSelect);

      const startTime = Date.now();
      const { element: loadingLi, updateElapsedTime } = addLoadingMessage();
      input.value = "";
      input.focus();

      // Start updating elapsed time every 100ms
      const intervalId = globalThis.setInterval(() => {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        updateElapsedTime(elapsedSeconds);
      }, 100);

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

        // Clear the interval and show final elapsed time
        globalThis.clearInterval(intervalId);
        const finalElapsedSeconds = (Date.now() - startTime) / 1000;
        updateElapsedTime(finalElapsedSeconds);

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
        // Clear the interval on error
        globalThis.clearInterval(intervalId);

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
      renderSuggestions(messages, handleSampleSelect);
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
