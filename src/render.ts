import type { ChatMessage } from "./types.ts";
import { compileQbjsUrl } from "./qbjs.ts";
import { SYSTEM_REPLY_CODE } from "./config.ts";

export function renderMessage(
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
  } else if ((message as ChatMessage).role === "error") {
    li.textContent = `Error: ${(message as ChatMessage).text}`;
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

    const link = document.createElement("a");
    link.href = compileQbjsUrl(code);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open in QBJS IDE";
    li.appendChild(link);
  } else {
    li.textContent = (message as ChatMessage).text;
  }
}

export function render(list: ChatMessage[]): void {
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

export function addLoadingMessage(): HTMLLIElement {
  const listEl = document.getElementById("messages") as HTMLOListElement | null;
  if (!listEl) throw new Error("Messages list not found");
  const li = document.createElement("li");
  renderMessage(li, { role: "loading" });
  listEl.appendChild(li);
  listEl.scrollTop = listEl.scrollHeight;
  return li;
}
