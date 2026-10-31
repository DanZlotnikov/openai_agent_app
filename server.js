import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";

const app = express();
const port = Number(process.env.PORT || 3000);
const maxFiles = 5;
const maxTotalBytes = 50 * 1024 * 1024;
const defaultOpenAIModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const providerModels = {
  openai: new Set(["gpt-4.1-mini", "gpt-4.1", defaultOpenAIModel]),
  anthropic: new Set(["claude-haiku-4-5-20251001", "claude-sonnet-5", "claude-opus-5"]),
};
const supportedExtensions = new Set([
  ".art", ".bat", ".brf", ".c", ".cls", ".css", ".csv", ".diff", ".doc", ".docx", ".dot", ".eml", ".epub", ".es", ".h", ".hs", ".htm", ".html", ".hwp", ".hwpx", ".ics", ".ifb", ".java", ".js", ".json", ".keynote", ".ksh", ".ltx", ".mail", ".markdown", ".md", ".mht", ".mhtml", ".mjs", ".msg", ".nws", ".odp", ".ods", ".odt", ".otp", ".ots", ".pages", ".patch", ".pdf", ".pl", ".pm", ".pot", ".potm", ".potx", ".ppa", ".pps", ".ppsm", ".ppsx", ".ppt", ".pptm", ".pptx", ".pwz", ".py", ".rst", ".rtf", ".scala", ".sh", ".shtml", ".srt", ".sty", ".svg", ".svgz", ".tex", ".text", ".tsv", ".txt", ".vcf", ".vtt", ".wiz", ".xla", ".xlb", ".xlc", ".xlm", ".xls", ".xlsx", ".xlt", ".xlw", ".xml", ".yaml", ".yml",
]);
const anthropicTextExtensions = new Set([
  ".c", ".css", ".csv", ".h", ".htm", ".html", ".java", ".js", ".json", ".markdown", ".md", ".mjs", ".pl", ".py", ".rst", ".sh", ".sql", ".text", ".tsv", ".txt", ".xml", ".yaml", ".yml",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: maxFiles, fileSize: maxTotalBytes },
});

app.use(express.static("public"));

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({ role: item.role, content: String(item.content || "").slice(0, 50_000) }))
    .filter((item) => item.content.trim())
    .slice(-16);
}

function createAnthropicContent(files, message) {
  const unsupportedFiles = files.filter((file) => {
    const extension = path.extname(file.originalname).toLowerCase();
    return extension !== ".pdf" && !anthropicTextExtensions.has(extension);
  });
  if (unsupportedFiles.length) {
    const names = unsupportedFiles.map((file) => file.originalname).join(", ");
    throw Object.assign(new Error(`Claude accepts PDFs and text/code attachments. Convert these files to PDF or text first: ${names}`), { status: 400 });
  }

  return [
    ...files.map((file) => {
      const extension = path.extname(file.originalname).toLowerCase();
      if (extension === ".pdf") {
        return {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: file.buffer.toString("base64") },
        };
      }
      return { type: "text", text: `\n\n--- ${file.originalname} ---\n${file.buffer.toString("utf8")}` };
    }),
    { type: "text", text: message || "Please review the attached file(s)." },
  ];
}

app.post("/api/chat", upload.array("files", maxFiles), async (req, res) => {
  const files = req.files || [];
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const message = String(req.body.message || "").trim();
  const provider = String(req.body.provider || "openai");
  const model = String(req.body.model || defaultOpenAIModel);
  const unsupportedFiles = files.filter((file) => !supportedExtensions.has(path.extname(file.originalname).toLowerCase()));

  if (!providerModels[provider]?.has(model)) return res.status(400).json({ error: "Choose one of the available models." });
  if (!message && files.length === 0) return res.status(400).json({ error: "Write a message or attach at least one file." });
  if (totalBytes > maxTotalBytes) return res.status(413).json({ error: "Attached files must total 50 MB or less." });
  if (unsupportedFiles.length) {
    const names = unsupportedFiles.map((file) => file.originalname).join(", ");
    return res.status(400).json({ error: `Unsupported file type: ${names}. Please attach a PDF, document, spreadsheet, presentation, or supported text/code file.` });
  }

  let history;
  try {
    history = cleanHistory(JSON.parse(req.body.history || "[]"));
  } catch {
    return res.status(400).json({ error: "The chat history could not be read." });
  }

  if (provider === "openai" && !process.env.OPENAI_API_KEY) return res.status(503).json({ error: "OPENAI_API_KEY is missing. Add it to your .env file, then restart the server." });
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "ANTHROPIC_API_KEY is missing. Add it to your .env file, then restart the server." });
  if (!process.env.AICR_GATEWAY_KEY) return res.status(503).json({ error: "AICR_GATEWAY_KEY is missing. Add it to your .env file, then restart the server." });

  const uploadedFileIds = [];
  let openAIClient;
  try {
    if (provider === "anthropic") {
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: "https://gateway.danzlotnikov.com/anthropic",
        defaultHeaders: { "x-aicr-key": process.env.AICR_GATEWAY_KEY },
      });
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [
          ...history.map((entry) => ({ role: entry.role, content: entry.content })),
          { role: "user", content: createAnthropicContent(files, message) },
        ],
      });
      const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim() || "I could not generate a text response.";
      return res.json({ text, provider, model });
    }

    openAIClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://gateway.danzlotnikov.com/openai/v1",
      defaultHeaders: { "x-aicr-key": process.env.AICR_GATEWAY_KEY },
    });
    const fileParts = await Promise.all(files.map(async (file) => {
      const uploaded = await openAIClient.files.create({
        file: new File([file.buffer], file.originalname, { type: file.mimetype || "application/octet-stream" }),
        purpose: "user_data",
      });
      uploadedFileIds.push(uploaded.id);
      return { type: "input_file", file_id: uploaded.id };
    }));
    const input = history.map((entry) => ({
      role: entry.role,
      content: [{ type: entry.role === "assistant" ? "output_text" : "input_text", text: entry.content }],
    }));
    input.push({ role: "user", content: [{ type: "input_text", text: message || "Please review the attached file(s)." }, ...fileParts] });

    const response = await openAIClient.responses.create({ model, input });
    const text = response.output_text?.trim() || "I could not generate a text response.";
    return res.json({ text, provider, model });
  } catch (error) {
    console.error(`${provider} request failed:`, { status: Number(error?.status) || 500, requestId: error?.requestID, message: error?.message });
    const status = Number(error?.status) || 500;
    const providerName = provider === "anthropic" ? "Anthropic" : "OpenAI";
    const errorMessage = status === 401
      ? `Your ${providerName} API key was rejected. Check your .env file.`
      : status === 429
        ? `${providerName} rate limit reached. Please try again shortly.`
        : error?.message || `Something went wrong while contacting ${providerName}.`;
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: errorMessage });
  } finally {
    if (openAIClient) await Promise.allSettled(uploadedFileIds.map((id) => openAIClient.files.delete(id)));
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Each file must be 50 MB or less."
      : error.code === "LIMIT_FILE_COUNT" ? `You can attach up to ${maxFiles} files at once.`
        : "There was a problem reading the attachment.";
    return res.status(400).json({ error: message });
  }
  console.error(error);
  return res.status(500).json({ error: "Unexpected server error." });
});

app.listen(port, () => {
  console.log(`AI File Chat is running at http://localhost:${port}`);
});
