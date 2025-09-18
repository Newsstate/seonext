// app/lib/modelShim.ts
export async function callModelOpenAIJSON(payload: { system: string; user: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini"; // or any JSON-capable model
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: payload.system },
        { role: "user", content: payload.user }
      ]
    })
  });
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content ?? "{}";
  return txt as string;
}
