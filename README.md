# AI File Chat

A tiny local chat app: choose an OpenAI or Claude model for each message, optionally attach up to five files, and receive the response in the chat.

## Run locally

1. Install Node.js 20 or later.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and add your OpenAI API key and AICR gateway key:

   ```env
   OPENAI_API_KEY=your_key_here
   AICR_GATEWAY_KEY=your_gateway_key_here
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
- The server routes requests through `https://gateway.danzlotnikov.com/openai/v1`; the AICR gateway key stays server-side in `.env`.
- The model picker can switch between OpenAI and Claude per message. The conversation remains in the browser tab, so either provider can use the previous text turns as context.
- OpenAI uses the Responses API and accepts supported documents, spreadsheets, presentations, PDFs, and text/code files. Claude accepts PDFs and text/code files; convert other document formats to PDF or text before selecting Claude.
- OpenAI uploads are deleted after each response. Each request supports up to five files totaling 50 MB.
