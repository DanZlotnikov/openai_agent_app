const form = document.querySelector("#chat-form");
const chat = document.querySelector("#chat");
const messageInput = document.querySelector("#message");
const filesInput = document.querySelector("#files");
const attachments = document.querySelector("#attachments");
const sendButton = document.querySelector("#send-button");
const clearButton = document.querySelector("#clear-button");
const modelSelect = document.querySelector("#model");
const supportedExtensions = new Set(
  filesInput.accept.split(",").map((extension) => extension.trim().toLowerCase()),
);

let selectedFiles = [];
let history = [];
let dragDepth = 0;

function autoResize() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 180)}px`;
}

function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  const template = document.createElement("div");
  template.textContent = value;
  return template.innerHTML;
}

function renderAttachments() {
  attachments.innerHTML = "";
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "attachment";
    item.innerHTML = `<span title="${escapeHtml(file.name)}">${escapeHtml(file.name)} - ${formatBytes(file.size)}</span><button type="button" aria-label="Remove ${escapeHtml(file.name)}">x</button>`;
    item.querySelector("button").addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderAttachments();
    });
    attachments.append(item);
  });
}

function addMessage(role, text, files = [], labelOverride = "") {
  document.querySelector("#empty-state")?.remove();
  const message = document.createElement("article");
  message.className = `message ${role}`;
  const label = labelOverride || (role === "user" ? "You" : role === "assistant" ? "Assistant" : "Notice");
  message.innerHTML = `<div class="message-meta">${label}</div><div class="message-text"></div>`;
  message.querySelector(".message-text").textContent = text;
  if (files.length) {
    const fileList = document.createElement("div");
    fileList.className = "message-files";
    files.forEach((file) => {
      const tag = document.createElement("span");
      tag.className = "file-tag";
      tag.textContent = `File: ${file.name}`;
      fileList.append(tag);
    });
    message.append(fileList);
  }
  chat.append(message);
  message.scrollIntoView({ block: "end", behavior: "smooth" });
}

function addFiles(incoming) {
  const files = Array.from(incoming || []);
  const unsupported = files.filter((file) => {
    const extension = `.${file.name.split(".").pop().toLowerCase()}`;
    return !supportedExtensions.has(extension);
  });
  const combined = [...selectedFiles, ...files];
  const totalSize = combined.reduce((sum, file) => sum + file.size, 0);

  if (unsupported.length) {
    addMessage("error", "That file type is not supported. Attach a PDF, document, spreadsheet, presentation, or supported text/code file.");
    return;
  }
  if (combined.length > 5) {
    addMessage("error", "You can attach up to 5 files at once.");
    return;
  }
  if (totalSize > 50 * 1024 * 1024) {
    addMessage("error", "Attached files must total 50 MB or less.");
    return;
  }
  selectedFiles = combined;
  renderAttachments();
}

function setLoading(loading) {
  sendButton.disabled = loading;
  sendButton.querySelector("span").textContent = loading ? "Thinking..." : "Send";
}

function resetEmptyState() {
  chat.innerHTML = `<div class="empty-state" id="empty-state"><div class="sparkle">*</div><h1>Ask anything. Add a file if it helps.</h1><p>Choose a model for each message, then add an attachment if it helps.</p></div>`;
}

messageInput.addEventListener("input", autoResize);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

filesInput.addEventListener("change", () => {
  addFiles(filesInput.files);
  filesInput.value = "";
});

form.addEventListener("dragenter", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  dragDepth += 1;
  form.classList.add("is-dragging");
});
form.addEventListener("dragover", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});
form.addEventListener("dragleave", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  dragDepth -= 1;
  if (dragDepth <= 0) {
    dragDepth = 0;
    form.classList.remove("is-dragging");
  }
});
form.addEventListener("drop", (event) => {
  if (!event.dataTransfer?.files?.length) return;
  event.preventDefault();
  dragDepth = 0;
  form.classList.remove("is-dragging");
  addFiles(event.dataTransfer.files);
});
window.addEventListener("dragover", (event) => {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
});
window.addEventListener("drop", (event) => {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
});

clearButton.addEventListener("click", () => {
  history = [];
  selectedFiles = [];
  renderAttachments();
  resetEmptyState();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  const files = [...selectedFiles];
  const [provider, model] = modelSelect.value.split("|");
  const modelLabel = modelSelect.selectedOptions[0].textContent.trim();
  if (!text && !files.length) return;

  addMessage("user", text || "Please review the attached file(s).", files, `You - ${modelLabel}`);
  messageInput.value = "";
  autoResize();
  selectedFiles = [];
  renderAttachments();
  setLoading(true);

  const payload = new FormData();
  payload.append("message", text);
  payload.append("history", JSON.stringify(history));
  payload.append("provider", provider);
  payload.append("model", model);
  files.forEach((file) => payload.append("files", file));

  try {
    const response = await fetch("/api/chat", { method: "POST", body: payload });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The request failed.");
    addMessage("assistant", data.text, [], modelLabel);
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
