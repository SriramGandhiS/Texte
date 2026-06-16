# KRS Question Paper Tool

School question-paper generator for **Krishnammal Ramasubbaiyer School** — manual editor, live preview, and local AI assistant (Ollama).

## Folder location

```
D:\krs-question-paper-tool\
```

## First-time setup (copy app files)

Double-click **`SETUP.bat`** or run:

```powershell
powershell -ExecutionPolicy Bypass -File D:\krs-question-paper-tool\scripts\setup-from-source.ps1
```

This copies `public/index.html` and `lib/ai-core.js` from your Codex outputs folder.

## Project structure

```
krs-question-paper-tool/
├── SETUP.bat               # Run once to copy index.html + ai-core.js
├── README.md
├── package.json
├── netlify.toml
├── .gitignore
├── public/
│   └── index.html          # Main app (created by SETUP.bat)
├── lib/
│   └── ai-core.js          # Local Ollama server (created by SETUP.bat)
├── server/
│   └── local-server.js     # Starts lib/ai-core.js
├── netlify/functions/      # Netlify API (optional AI on web)
├── scripts/
│   ├── setup-from-source.ps1
│   └── START-KRS-PAPER-TOOL.bat
└── docs/
    └── DEPLOYMENT.md
```

## Quick start (local — full AI)

1. Install [Node.js](https://nodejs.org/) and [Ollama](https://ollama.com/)
2. Pull a model: `ollama pull llama3.1`
3. Double-click `scripts/START-KRS-PAPER-TOOL.bat`
4. Open **http://127.0.0.1:8787**

Or:

```bash
npm install
npm start
```

## Netlify deploy

### What works on Netlify

| Feature | Netlify | Local |
|---------|---------|-------|
| Paper editor & preview | Yes | Yes |
| PDF / print | Yes | Yes |
| AI assistant | Needs `OLLAMA_URL` env | Yes (Ollama on your PC) |

Netlify hosts the **static app**. AI calls go through **Netlify Functions**, which proxy to your Ollama instance.

### Deploy steps

1. Push this folder to GitHub
2. Connect repo in [Netlify](https://app.netlify.com/)
3. Build settings (auto from `netlify.toml`):
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
4. Optional env vars in Netlify → Site settings → Environment variables:
   - `OLLAMA_URL` — e.g. `http://127.0.0.1:11434` only works if you tunnel Ollama; for production use a hosted Ollama or skip AI on web
   - `OLLAMA_MODEL` — e.g. `llama3.1:latest`

### Git push

```bash
cd D:\krs-question-paper-tool
git init
git add .
git commit -m "Initial commit: KRS question paper tool"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Local server port |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `llama3.1:latest` | Default model |

## License

Private / school use.
