# Deployment Guide

## Folder on disk

```
D:\krs-question-paper-tool\
```

## Local use (full AI with Ollama)

1. Install [Node.js 18+](https://nodejs.org/) and [Ollama](https://ollama.com/)
2. `ollama pull llama3.1`
3. Double-click `scripts\START-KRS-PAPER-TOOL.bat`
4. Open http://127.0.0.1:8787

Or:

```bash
cd D:\krs-question-paper-tool
npm start
```

## Git + GitHub

```bash
cd D:\krs-question-paper-tool
git init
git add .
git commit -m "KRS question paper tool"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/krs-question-paper-tool.git
git push -u origin main
```

## Netlify

1. Push to GitHub
2. [Netlify](https://app.netlify.com/) → Add new site → Import from Git
3. Settings are read from `netlify.toml` automatically
4. Deploy

### Netlify environment variables (optional, for AI on web)

| Key | Example | Notes |
|-----|---------|-------|
| `OLLAMA_URL` | `https://your-ollama-host` | Ollama must be reachable from Netlify servers |
| `OLLAMA_MODEL` | `llama3.1:latest` | Default model |

**Note:** Paper editor works on Netlify without any env vars. AI needs a reachable Ollama URL. For daily school use, run locally with the `.bat` file.

## What works where

| Feature | Netlify | Local |
|---------|---------|-------|
| Paper editor | Yes | Yes |
| PDF / print | Yes | Yes |
| AI chat | If `OLLAMA_URL` set | Yes |
| Unlimited Ollama | No (needs your PC) | Yes |
