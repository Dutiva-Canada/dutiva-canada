export default async function handler(req, res) {
    if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
    }

  res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
        const { max_tokens, system, messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
              return res.status(400).json({ error: "messages array is required" });
      }

      // Convert Anthropic-style messages to Gemini format
      const geminiContents = [];

      // Add system instruction as the first user turn if provided
      if (system) {
              geminiContents.push({ role: "user", parts: [{ text: system }] });
              geminiContents.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });
      }

      for (const msg of messages) {
              geminiContents.push({
                        role: msg.role === "assistant" ? "model" : "user",
                        parts: [{ text: msg.content }],
              });
      }

      const geminiModel = "gemini-2.0-flash";
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                        contents: geminiContents,
                        generationConfig: {
                                    maxOutputTokens: max_tokens || 1000,
                        },
              }),
      });

      const data = await response.json();

      if (!response.ok) {
              return res.status(response.status).json(data);
      }

      // Normalize Gemini response to match Anthropic format expected by frontend
      // Frontend expects: { content: [{ type: "text", text: "..." }] }
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
        return res.status(200).json({
                content: [{ type: "text", text }],
        });
  } catch (error) {
        console.error("Serverless function error:", error);
        return res.status(500).json({ error: "Internal server error" });
  }
}
