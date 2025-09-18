// app/lib/modelShim.ts
// Uses Perplexity instead of OpenAI, but keeps the same function name/signature
// so the rest of your code (runAIEEAT, etc.) does not need changes.

export async function callModelOpenAIJSON(payload: { system: string; user: string }) {
  const apiKey = process.env.PPLX_API_KEY;
  const model = process.env.PPLX_MODEL || "sonar-reasoning-pro"; // e.g. sonar-pro, sonar-reasoning-pro, sonar-small

  if (!apiKey) {
    throw new Error("PPLX_API_KEY missing");
  }

  const body = {
    model,
    // Perplexity follows the OpenAI-style chat schema
    messages: [
      {
        role: "system",
        content:
          (payload.system || "") +
          "\n\nYou must reply with a single valid JSON object. Do not include explanations or markdown.",
      },
      { role: "user", content: payload.user },
    ],
    temperature: 0.1,
    top_p: 0.9,
    // Perplexity-specific flags
    return_citations: false,
    stream: false,
  };

  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errTxt = await r.text().catch(() => "");
    throw new Error(`Perplexity API error ${r.status}: ${errTxt}`);
  }

  const j = await r.json();
  // Perplexity returns OpenAI-style choices/message/content
  const txt = j?.choices?.[0]?.message?.content ?? "{}";
  return txt as string;
}
