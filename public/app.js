const form = document.querySelector("#chat-form");
const chat = document.querySelector("#chat");
const messageInput = document.querySelector("#message");
const filesInput = document.querySelector("#files");
const attachments = document.querySelector("#attachments");
const sendButton = document.querySelector("#send-button");
const clearButton = document.querySelector("#clear-button");

let selectedFiles = [];
let history = [];

function autoResize() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 180)}px`;
}

function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderAttachments() {
  attachments.innerHTML = "";
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "attachment";
    item.innerHTML = `<span title="${escapeHtml(file.name)}">${escapeHtml(file.name)} · ${formatBytes(file.size)}</span><button type="button" aria-label="Remove ${escapeHtml(file.name)}">×</button>`;
    item.querySelector("button").addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderAttachments();
    });
    attachments.append(item);
  });
}

function escapeHtml(value) {
  const template = document.createElement("div");
  template.textContent = value;
  return template.innerHTML;
}

function addMessage(role, text, files = []) {
  document.querySelector("#empty-state")?.remove();
  const message = document.createElement("article");
  message.className = `message ${role}`;
  const label = role === "user" ? "You" : role === "assistant" ? "OpenAI" : "Notice";
  message.innerHTML = `<div class="message-meta">${label}</div><div class="message-text"></div>`;
  message.querySelector(".message-text").textContent = text;
  if (files.length) {
    const fileList = document.createElement("div");
    fileList.className = "message-files";
    files.forEach((file) => {
      const tag = document.createElement("span");
      tag.className = "file-tag";
      tag.textContent = `⌁ ${file.name}`;
      fileList.append(tag);
    });
    message.append(fileList);
  }
  chat.append(message);
  message.scrollIntoView({ block: "end", behavior: "smooth" });
}

function setLoading(loading) {
  sendButton.disabled = loading;
  sendButton.querySelector("span").textContent = loading ? "Thinking…" : "Send";
}

messageInput.addEventListener("input", autoResize);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

filesInput.addEventListener("change", () => {
  const incoming = Array.from(filesInput.files || []);
  const combined = [...selectedFiles, ...incoming];
  const totalSize = combined.reduce((sum, file) => sum + file.size, 0);
  if (combined.length > 5) return addMessage("error", "You can attach up to 5 files at once.");
  if (totalSize > 50 * 1024 * 1024) return addMessage("error", "Attached files must total 50 MB or less.");
  selectedFiles = combined;
  filesInput.value = "";
  renderAttachments();
});

clearButton.addEventListener("click", () => {
  history = [];
  selectedFiles = [];
  renderAttachments();
  chat.innerHTML = `<div class="empty-state" id="empty-state"><div class="sparkle">✦</div><h1>Ask anything. Add a file if it helps.</h1><p>Your messages and optional attachments go directly to OpenAI from this local app.</p></div>`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  const files = [...selectedFiles];
  if (!text && !files.length) return;

  addMessage("user", text || "Please review the attached file(s).", files);
  messageInput.value = "";
  autoResize();
  selectedFiles = [];
  renderAttachments();
  setLoading(true);

  const payload = new FormData();
  payload.append("message", text);
  payload.append("history", JSON.stringify(history));
  files.forEach((file) => payload.append("files", file));

  try {
    const response = await fetch("/api/chat", { method: "POST", body: payload });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The request failed.");
    addMessage("assistant", data.text);
    history.push({ role: "user", content: text || "Please review the attached file(s)." });
    history.push({ role: "assistant", content: data.text });
  } catch (error) {
    addMessage("error", error.message || "Could not reach the server.");
  } finally {
    setLoading(false);
    messageInput.focus();
  }
});

autoResize();
