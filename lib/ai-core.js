const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:latest";
const APP_FILE = path.join(__dirname, "../public/index.html");

function apiPath(req) {
  return String(req.url || "").split("?")[0];
}

const CBSE_HINTS = [
  { match: /amanda/i, query: "CBSE Class 10 English poem Amanda themes instructions imagination", url: "https://cbseacademic.nic.in/" },
  { match: /roadside stand|aunt jennifer|tiger|fire and ice|dust of snow/i, query: "CBSE Class 10 English First Flight poems", url: "https://ncert.nic.in/textbook.php" },
  { match: /class\s*10|class\s*x\b/i, query: "CBSE Class 10 English question paper pattern", url: "https://cbse.gov.in/" },
  { match: /class\s*12|class\s*xii\b/i, query: "CBSE Class 12 English question paper pattern", url: "https://cbse.gov.in/" },
  { match: /pyq|previous year/i, query: "CBSE English previous year questions", url: "https://cbse.gov.in/" },
  { match: /ncert/i, query: "NCERT English textbook question pattern", url: "https://ncert.nic.in/" }
];

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_500_000) {
        reject(new Error("Request is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function extractJson(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    const replyMatch = raw.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (replyMatch) {
      return {
        reply: replyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
        warnings: [],
        proposals: []
      };
    }
    return null;
  }
}

function isCasualMessage(text) {
  const t = String(text || "").trim().toLowerCase();
  return /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|ok|okay|bye|namaste)[!.?\s]*$/i.test(t);
}

function casualReply(memory) {
  const style = memory?.preferredNumbering === "number" ? "1. 2. 3." : "Roman I, II, III.";
  return {
    reply: `Hello. I am ready to help with your question paper. You can ask me to draft CBSE-style questions, MCQs, passage sets, or check marks. Example: "Give me 5 MCQ on Amanda, ${style} numbering, 5 marks."`,
    warnings: [],
    proposals: []
  };
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url, maxChars = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KRS-Paper-Tool/1.0)",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8"
      }
    });
    if (!response.ok) return "";
    const text = await response.text();
    return stripHtml(text).slice(0, maxChars);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function searchDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url, 12000);
  if (!html) return { text: "", sources: [] };

  const snippets = [];
  const sources = [];
  const parts = html.split(/class="result__a"/i).slice(1, 4);
  for (const part of parts) {
    const titleMatch = part.match(/>([^<]{4,120})</);
    const hrefMatch = part.match(/href="([^"]+)"/);
    const snippetMatch = part.match(/class="result__snippet"[^>]*>([^<]{20,500})</i);
    if (titleMatch) snippets.push(titleMatch[1].trim());
    if (snippetMatch) snippets.push(snippetMatch[1].trim());
    if (hrefMatch && /cbse|ncert|education|academic/i.test(hrefMatch[1] + (titleMatch?.[1] || ""))) {
      sources.push(hrefMatch[1]);
    }
  }

  return {
    text: snippets.join(" | ").slice(0, 2500),
    sources: [...new Set(sources)].slice(0, 3)
  };
}

function analyzeTeacherIntent(message, memory) {
  const text = String(message || "");
  const lower = text.toLowerCase();
  const intent = {
    wantsAdd: /add|make|create|prepare|draft|give me|generate/i.test(text),
    wantsFetch: /fetch|search|internet|online|cbse|ncert|pyq|syllabus|website/i.test(text),
    wantsMcq: /\bmcq\b|multiple choice|objective/i.test(lower),
    wantsPassage: /passage|extract|reading comprehension|unseen/i.test(lower),
    wantsRoman: /roman/i.test(lower),
    wantsNumeric: /\b1\.|numeric|numbering|1, 2, 3/i.test(lower),
    classLevel: (lower.match(/class\s*(\d+|x|xi|xii)/i) || [])[1] || "",
    topic: ""
  };

  const topics = ["amanda", "roadside stand", "aunt jennifer", "application", "notice", "article", "pyq", "ncert"];
  intent.topic = topics.find((topic) => lower.includes(topic)) || "";

  if (memory?.preferredNumbering && !intent.wantsNumeric) intent.preferredNumbering = memory.preferredNumbering;
  if (intent.wantsRoman) intent.preferredNumbering = "roman";
  if (intent.wantsNumeric) intent.preferredNumbering = "number";

  const common = Object.entries(memory?.commonRequests || {}).sort((a, b) => b[1] - a[1]);
  intent.usualStyle = common.slice(0, 3).map(([key]) => key).join(", ");

  return intent;
}

async function gatherOnlineContext(message) {
  const steps = ["Reading your request..."];
  const sources = [];
  let context = "";

  const lower = String(message || "").toLowerCase();
  const shouldFetch = /fetch|search|internet|online|cbse|ncert|pyq|syllabus|website|think/i.test(lower);
  if (!shouldFetch) {
    steps.push("Using local Ollama knowledge and your paper context.");
    return { steps, sources, context };
  }

  steps.push("Searching CBSE / NCERT references online...");
  const hints = CBSE_HINTS.filter((hint) => hint.match.test(message));
  const queries = hints.length
    ? hints.map((hint) => hint.query)
    : [`CBSE ${message}`.slice(0, 120)];

  for (const query of queries.slice(0, 2)) {
    const result = await searchDuckDuckGo(query);
    if (result.text) context += `${result.text}\n`;
    sources.push(...result.sources);
  }

  for (const hint of hints.slice(0, 1)) {
    if (!hint.url) continue;
    steps.push(`Fetching ${new URL(hint.url).hostname}...`);
    const pageText = await fetchText(hint.url, 1800);
    if (pageText) context += `${pageText}\n`;
    sources.push(hint.url);
  }

  if (context.trim()) {
    steps.push(`Online context gathered from ${Math.min(sources.length, 3) || 1} source(s).`);
  } else {
    steps.push("Online fetch was limited; continuing with local model knowledge.");
  }

  return { steps, sources: [...new Set(sources)], context: context.slice(0, 5000) };
}

function buildPrompt({ messages, paper, memory, onlineContext, intent }) {
  return [
    "You are an advanced local AI assistant for an English teacher creating CBSE-style school question papers.",
    "Behave like a careful ChatGPT helper: understand intent, think step-by-step internally, and respond usefully.",
    "Use ONLINE CONTEXT when provided. Combine it with CBSE/NCERT knowledge to create original practice questions.",
    "Do not reproduce full copyrighted poems/chapters. For passage-reading, write short original passages inspired by the theme.",
    "When the teacher asks to add/make/create questions, return one proposal card. Never claim you already added to the paper.",
    "If marks look inconsistent with the paper total, add a warning.",
    "Respect teacher preferences from memory and intent (roman vs numeric numbering, MCQ vs passage, NCERT/PYQ style).",
    "JSON shape only:",
    "{\"reply\":\"short helpful response mentioning what you understood\",\"warnings\":[\"...\"],\"proposals\":[{\"title\":\"...\",\"target\":\"new-section|existing-section|question\",\"sectionTitle\":\"...\",\"sectionMarks\":\"...\",\"sectionNumbering\":\"roman|number\",\"passage\":\"optional short passage\",\"direction\":\"optional instruction line\",\"questions\":[{\"text\":\"...\",\"marks\":\"1\",\"answerSpace\":\"none|3|5|10|half|full\",\"subType\":\"upper|lowerRoman\",\"subs\":[{\"text\":\"...\"}]}]}]}",
    "MCQ: one question with four subs A/B/C/D. Passage-reading: include passage in proposal.passage.",
    "If the teacher only greets you (hi/hello) or asks a normal question without add-to-paper intent, reply warmly and leave proposals empty.",
    "ONLY include proposals when the teacher clearly asks to add, make, create, draft, or give questions for the paper.",
    "",
    "TEACHER INTENT:",
    JSON.stringify(intent || {}),
    "",
    "ONLINE CONTEXT:",
    onlineContext || "(none)",
    "",
    "CURRENT PAPER:",
    JSON.stringify(paper || {}),
    "",
    "PATTERN MEMORY:",
    JSON.stringify(memory || {}),
    "",
    "RECENT CHAT:",
    JSON.stringify((messages || []).slice(-10)),
    "",
    "Return valid JSON only."
  ].join("\n");
}

function normalizeResult(parsed, fallbackText = "", intent = {}) {
  if (!parsed && String(fallbackText).trim().startsWith("{")) {
    parsed = extractJson(fallbackText);
  }

  let reply = String(parsed?.reply || "").trim();
  if (!reply && fallbackText && !String(fallbackText).trim().startsWith("{")) {
    reply = String(fallbackText).trim();
  }
  if (!reply || reply.startsWith("{")) {
    reply = "I am ready. Tell me what questions to add — include topic, marks, and Roman or numeric numbering.";
  }

  let proposals = Array.isArray(parsed?.proposals) ? parsed.proposals : [];
  if (!intent?.wantsAdd) proposals = [];

  return {
    reply,
    warnings: Array.isArray(parsed?.warnings) ? parsed.warnings : [],
    proposals
  };
}

function localAmandaFallback() {
  return {
    reply: "I prepared a CBSE-style Amanda passage-reading set. Review once, then click Add to Question Paper.",
    warnings: ["Review once before printing."],
    proposals: [
      {
        title: "Amanda Passage Reading",
        target: "new-section",
        sectionTitle: "READ THE FOLLOWING PASSAGE CAREFULLY",
        sectionMarks: "10",
        sectionNumbering: "roman",
        passage: "Amanda remains quiet while instructions are repeatedly given to her. She is told how to sit, what not to do, and how to behave. Outwardly she appears silent, but inwardly she escapes into a private world where she feels free and untouched by constant correction. Her imagination becomes her shelter from control.",
        direction: "Answer the following questions, based on the passage above.",
        questions: [
          { text: "What does Amanda's silence reveal about her inner state?", marks: "1", answerSpace: "3", subType: "upper", subs: [] },
          { text: "How does the adult voice affect Amanda?", marks: "1", answerSpace: "3", subType: "upper", subs: [] },
          { text: "Which idea is most strongly contrasted in the passage?", marks: "1", answerSpace: "none", subType: "upper", subs: [
            { text: "Control and freedom" }, { text: "Wealth and poverty" }, { text: "Noise and music" }, { text: "Travel and study" }
          ] },
          { text: "Why does Amanda turn to imagination?", marks: "1", answerSpace: "3", subType: "upper", subs: [] },
          { text: "The phrase 'private world' suggests that Amanda wants", marks: "1", answerSpace: "none", subType: "upper", subs: [
            { text: "space away from constant correction" }, { text: "more school work" }, { text: "attention from friends" }, { text: "to argue loudly" }
          ] },
          { text: "What kind of parenting is indirectly criticised here?", marks: "1", answerSpace: "3", subType: "upper", subs: [] },
          { text: "Pick one phrase that shows Amanda's desire for independence.", marks: "1", answerSpace: "3", subType: "upper", subs: [] },
          { text: "How is imagination shown as a form of escape?", marks: "1", answerSpace: "5", subType: "upper", subs: [] },
          { text: "Explain why Amanda's silence should not be seen as happiness.", marks: "1", answerSpace: "5", subType: "upper", subs: [] },
          { text: "Give a suitable title to the passage and justify it.", marks: "1", answerSpace: "3", subType: "upper", subs: [] }
        ]
      }
    ]
  };
}

async function listOllamaModels() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((model) => model.name).filter(Boolean);
  } catch {
    return [];
  }
}

async function callOllama({ model, messages, paper, memory, onlineContext, intent }) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || OLLAMA_MODEL,
      stream: false,
      format: "json",
      options: {
        temperature: 0.25,
        num_predict: 2800
      },
      messages: [
        {
          role: "user",
          content: buildPrompt({ messages, paper, memory, onlineContext, intent })
        }
      ]
    })
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = JSON.parse(body);
  const content = data.message?.content || "{}";
  const parsed = extractJson(content);
  if (!parsed) return normalizeResult(null, content, intent);
  return normalizeResult(parsed, content, intent);
}

async function handleApi(req, res) {
  let payload = {};
  try {
    payload = JSON.parse(await readBody(req) || "{}");
    const model = payload.model || OLLAMA_MODEL;

    if (apiPath(req) === "/api/models") {
      const models = await listOllamaModels();
      sendJson(res, 200, { ok: true, models, defaultModel: OLLAMA_MODEL });
      return;
    }

    if (apiPath(req) === "/api/test-groq" || apiPath(req) === "/api/test-ai") {
      const result = await callOllama({
        model,
        messages: [{ role: "user", content: "Reply with JSON saying the local AI connection works." }],
        paper: payload.paper || {},
        memory: payload.memory || {},
        onlineContext: "",
        intent: { wantsAdd: false }
      });
      sendJson(res, 200, { ok: true, provider: "ollama", model, result, meta: { steps: ["Connected to local Ollama."] } });
      return;
    }

    if (apiPath(req) === "/api/ai") {
      const messages = payload.messages || [];
      const last = messages.slice(-1)[0]?.content || "";
      const intent = analyzeTeacherIntent(last, payload.memory || {});

      if (isCasualMessage(last)) {
        sendJson(res, 200, {
          ok: true,
          provider: "local",
          model,
          result: casualReply(payload.memory || {}),
          meta: { steps: ["Ready."], sources: [], intent }
        });
        return;
      }

      const online = await gatherOnlineContext(last);
      online.steps.push(`Thinking with ${model}...`);

      try {
        const result = await callOllama({
          model,
          messages,
          paper: payload.paper || {},
          memory: payload.memory || {},
          onlineContext: online.context,
          intent
        });
        sendJson(res, 200, {
          ok: true,
          provider: "ollama",
          model,
          result,
          meta: {
            steps: online.steps,
            sources: online.sources,
            intent
          }
        });
      } catch (error) {
        if (intent.wantsAdd && /amanda/i.test(last)) {
          sendJson(res, 200, {
            ok: true,
            provider: "offline-fallback",
            model: "local-template",
            result: localAmandaFallback(),
            meta: { steps: [...online.steps, "Ollama unavailable, used local Amanda template."], sources: online.sources, intent }
          });
          return;
        }
        throw error;
      }
      return;
    }

    sendJson(res, 404, { ok: false, error: "Unknown API route." });
  } catch (error) {
    const message = error.message === "fetch failed"
      ? "Local Ollama is not reachable. Open Ollama, pull a model (e.g. llama3.1), then restart START-KRS-PAPER-TOOL.bat."
      : (error.message || "Server error.");
    sendJson(res, 500, { ok: false, error: message });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && apiPath(req) === "/api/models") {
    listOllamaModels()
      .then((models) => sendJson(res, 200, { ok: true, models, defaultModel: OLLAMA_MODEL }))
      .catch(() => sendJson(res, 200, { ok: true, models: [], defaultModel: OLLAMA_MODEL }));
    return;
  }

  if (req.method === "POST" && apiPath(req).startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/krs-question-paper-tool.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    fs.createReadStream(APP_FILE)
      .on("error", () => {
        res.writeHead(404);
        res.end("App file not found.");
      })
      .pipe(res);
    return;
  }

  res.writeHead(404);
  res.end("Not found.");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`KRS question paper app running at http://127.0.0.1:${PORT}`);
  console.log(`AI provider: Ollama (${OLLAMA_MODEL}) at ${OLLAMA_URL}`);
  console.log("No API key needed. Unlimited local AI through Ollama.");
});
