exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const payload = JSON.parse(event.body || "{}");
  const last = String((payload.messages || []).slice(-1)[0]?.content || "").trim().toLowerCase();

  if (/^(hi|hello|hey|namaste)[!.?\s]*$/.test(last)) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        provider: "netlify",
        model: process.env.OLLAMA_MODEL || "llama3.1:latest",
        result: {
          reply: "Hello. The paper editor works here on Netlify. For full unlimited AI, run the app locally with scripts\\START-KRS-PAPER-TOOL.bat and Ollama on your PC.",
          warnings: [],
          proposals: []
        },
        meta: { steps: ["Ready."], sources: [], intent: {} }
      })
    };
  }

  if (!process.env.OLLAMA_URL) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "AI on Netlify needs OLLAMA_URL in site environment variables, or use the local .bat file with Ollama on your computer."
      })
    };
  }

  try {
    const { processApiRoute } = require("../../lib/ai-core");
    const body = await processApiRoute("/api/ai", payload);
    return { statusCode: body.ok === false ? 500 : 200, headers, body: JSON.stringify(body) };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message || "AI error." })
    };
  }
};
