const rules = [
  { category: "Electrical", terms: ["electric", "power", "light", "outlet", "wiring", "socket", "blackout"] },
  { category: "Plumbing", terms: ["water", "leak", "pipe", "faucet", "toilet", "drain", "flood"] },
  { category: "Facilities", terms: ["broken", "door", "window", "furniture", "ceiling", "classroom", "building"] },
  { category: "Cleaning", terms: ["trash", "dirty", "clean", "garbage", "pest", "spill", "sanitation"] },
  { category: "Network & IT", terms: ["wifi", "internet", "network", "computer", "projector", "printer", "login"] },
  { category: "Safety", terms: ["unsafe", "hazard", "fire", "smoke", "injury", "security", "emergency"] }
];

function localTriage(text) {
  const normalized = text.toLowerCase();
  const match = rules
    .map((rule) => ({
      category: rule.category,
      score: rule.terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score)[0];
  const category = match.score ? match.category : "General";
  const urgentWords = ["fire", "smoke", "flood", "exposed wire", "emergency", "injury", "unsafe"];
  const highWords = ["broken", "leak", "outage", "not working", "no water", "no power"];
  const priority = urgentWords.some((word) => normalized.includes(word))
    ? "urgent"
    : highWords.some((word) => normalized.includes(word))
      ? "high"
      : match.score
        ? "medium"
        : "low";

  return {
    category,
    priority,
    summary: `Suggested ${category.toLowerCase()} support based on the reported issue.`
  };
}

export async function classifyComplaint(text) {
  if (process.env.ENABLE_EXTERNAL_AI !== "true") return localTriage(text);
  if (!process.env.OPENAI_API_KEY) throw new Error("ENABLE_EXTERNAL_AI is true but OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Classify campus maintenance complaints. Return JSON with category (Electrical, Plumbing, Facilities, Cleaning, Network & IT, Safety, General), priority (low, medium, high, urgent), and a concise summary. Mark immediate hazards urgent."
        },
        { role: "user", content: text.slice(0, 3200) }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`AI classification failed (${response.status}): ${details.slice(0, 240)}`);
  }

  const payload = await response.json();
  const result = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
  const categories = rules.map(({ category }) => category).concat("General");
  const priorities = ["low", "medium", "high", "urgent"];
  if (!categories.includes(result.category) || !priorities.includes(result.priority) || typeof result.summary !== "string") {
    throw new Error("AI classification returned an invalid result.");
  }
  return { category: result.category, priority: result.priority, summary: result.summary.slice(0, 240) };
}
