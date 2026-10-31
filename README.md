# OpenAI File Chat

A tiny local chat app: type a prompt, optionally attach up to five files, and receive an OpenAI response in the chat.

## Run locally

1. Install Node.js 20 or later.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and add your OpenAI API key:

   ```env
   OPENAI_API_KEY=your_key_here
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

`npm start` runs the same app without watch mode.

## Notes

- The API key is read only by `server.js`; it is not exposed to the browser and `.env` is ignored by Git.
- The app uses the OpenAI Responses API so it can accept document, spreadsheet, text/code, and PDF attachments. Each request supports up to five files totaling 50 MB.
- Uploaded files are deleted from the OpenAI Files API after each response. Conversation text stays in this browser tab only.
- Set `OPENAI_MODEL` in `.env` if you want to use a different model available to your project.
