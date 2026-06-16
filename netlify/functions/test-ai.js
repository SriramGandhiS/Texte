exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  try {
    const payload = JSON.parse(event.body || "{}");
    const { processApiRoute } = require("../../lib/ai-core");
    const body = await processApiRoute("/api/test-ai", payload);
    return { statusCode: body.ok === false ? 500 : 200, headers, body: JSON.stringify(body) };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message || "AI test failed." })
    };
  }
};
