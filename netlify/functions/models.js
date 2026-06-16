exports.handler = async () => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  try {
    const { processApiRoute } = require("../../lib/ai-core");
    const body = await processApiRoute("/api/models", {});
    return { statusCode: 200, headers, body: JSON.stringify(body) };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, models: ["llama3.1:latest"], defaultModel: "llama3.1:latest" })
    };
  }
};
