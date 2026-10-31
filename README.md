# AI File Chat

A tiny local chat app: choose an OpenAI or Claude model for each message, optionally attach up to five files, and receive the response in the chat.

## Run locally

1. Install Node.js 20 or later.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and add your provider API keys:

   ```env
   OPENAI_API_KEY=your_key_here
   ANTHROPIC_API_KEY=your_anthropic_key_here
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

`npm start` runs the same app without watch mode.

## Notes

- Provider keys are read only by `server.js`; they are not exposed to the browser and `.env` is ignored by Git.
- OpenAI and Anthropic requests go directly to each provider's API, unless `AICR_GATEWAY_KEY` is set in `.env`, in which case both are routed through the AI Cost Review gateway for usage monitoring.
- The model picker can switch between OpenAI and Claude per message. The conversation remains in the browser tab, so either provider can use the previous text turns as context.
- OpenAI uses the Responses API and accepts supported documents, spreadsheets, presentations, PDFs, and text/code files. Claude accepts PDFs and text/code files; convert other document formats to PDF or text before selecting Claude.
- OpenAI uploads are deleted after each response. Each request supports up to five files totaling 50 MB.
