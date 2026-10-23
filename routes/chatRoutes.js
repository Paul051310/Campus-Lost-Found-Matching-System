
const express = require("express");
const router = express.Router();
const Item = require("../models/Item");

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const MODEL_NAME = "llama3.2:1b";

const SYSTEM_PROMPT = `
You are CampusFind AI, an assistant for the CampusFind Lost & Found Matching System.
Be friendly, concise, and accurate.
Never invent report details, counts, dates, locations, or statuses.
Never reveal reporter contact information.
Never claim that you submitted, edited, deleted, or confirmed a report.
Possible matches are suggestions, not proof.
For general CampusFind questions, explain how to use the website.
`;

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were",
  "i", "me", "my", "mine", "we", "our", "you", "your",
  "it", "this", "that", "to", "for", "of", "in", "on",
  "at", "and", "or", "but", "can", "could", "would",
  "should", "do", "does", "did", "have", "has", "had",
  "be", "been", "being", "find", "search", "look",
  "looking", "show", "tell", "any", "some", "about",
  "there", "please", "reported", "report", "reports",
  "item", "items", "campusfind", "anyone", "someone",
  "something", "check", "see", "know", "whether",
  "ever", "who", "many", "much", "total", "number",
  "count", "status", "details"
]);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makePublicItem(item) {
  return {
    itemName: item.itemName,
    type: item.type,
    category: item.category,
    description: item.description,
    location: item.location,
    date: item.date,
    status: item.status
  };
}

function formatDate(date) {
  if (!date) return "Not specified";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Not specified";
  }

  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila"
  });
}

function formatReportsAnswer(reports, searchedFor) {
  if (reports.length === 0) {
    return (
      `I couldn't find any matching reports for "${searchedFor}". ` +
      "Try another keyword or check Browse Reported Items."
    );
  }

  const lostCount = reports.filter(
    item => item.type === "Lost"
  ).length;

  const foundCount = reports.filter(
    item => item.type === "Found"
  ).length;

  const lines = reports.map((item, index) => {
    return [
      `${index + 1}. ${item.itemName}`,
      `   Type: ${item.type}`,
      `   Category: ${item.category || "Not specified"}`,
      `   Location: ${item.location || "Not specified"}`,
      `   Date: ${formatDate(item.date)}`,
      `   Status: ${item.status || "Not specified"}`,
      item.description
        ? `   Description: ${item.description}`
        : null
    ].filter(Boolean).join("\n");
  });

  return [
    `I found ${reports.length} matching report${reports.length === 1 ? "" : "s"} in CampusFind.`,
    `Lost reports: ${lostCount}`,
    `Found reports: ${foundCount}`,
    "",
    ...lines.flatMap((line, index) =>
      index === 0 ? [line] : ["", line]
    ),
    "",
    "Please verify the item details before assuming a match."
  ].join("\n");
}

router.post("/", async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        error: "Your message must be 1000 characters or fewer."
      });
    }

    const text = message.trim();

    const asksForReports =
      /\b(lost|found|reported|report|reports|item|items|cellphone|cell phone|phone|mobile|smartphone|wallet|bag|keys|laptop|umbrella|watch|samsung)\b/i.test(text);

    const asksForCount =
      /\b(how many|count|total|number of|statistics|stats)\b/i.test(text);

    const asksForStatus =
      /\b(open|matched|claimed|status)\b/i.test(text);

    // General questions use Ollama.
    if (!asksForReports && !asksForCount && !asksForStatus) {
      const safeHistory = Array.isArray(history)
        ? history
            .filter(item =>
              item &&
              ["user", "assistant"].includes(item.role) &&
              typeof item.content === "string"
            )
            .slice(-6)
            .map(item => ({
              role: item.role,
              content: item.content.slice(0, 1000)
            }))
        : [];

      const aiResponse = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          stream: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...safeHistory,
            { role: "user", content: text }
          ],
          options: { temperature: 0.2 }
        }),
        signal: AbortSignal.timeout(120000)
      });

      if (!aiResponse.ok) {
        return res.status(502).json({
          error: "The AI service returned an error. Please try again."
        });
      }

      const aiData = await aiResponse.json();
      const reply = aiData.message?.content;

      if (!reply) {
        return res.status(502).json({
          error: "The AI returned an empty response."
        });
      }

      return res.json({ reply });
    }

    // Identify item keywords.
    const words = text.toLowerCase().match(/[a-z0-9-]+/g) || [];

    let terms = [
      ...new Set(
        words.filter(word =>
          word.length >= 2 && !STOP_WORDS.has(word)
        )
      )
    ].slice(0, 6);

    // Add cellphone synonyms, but NOT "samsung" automatically.
    const phoneQuestion =
      /\b(cellphone|cell phone|phone|mobile|smartphone)\b/i.test(text);

    if (phoneQuestion) {
      terms = [
        ...new Set([
          ...terms,
          "phone",
          "cellphone",
          "mobile",
          "smartphone"
        ])
      ];
    }

    const query = {};

    // Only restrict type when the user explicitly asks for Lost or Found.
    const asksLost = /\blost\b/i.test(text);
    const asksFound = /\bfound\b/i.test(text);

    if (asksLost && !asksFound) {
      query.type = "Lost";
    } else if (asksFound && !asksLost) {
      query.type = "Found";
    }

    const statusMatch = text.match(/\b(open|matched|claimed)\b/i);

    if (statusMatch) {
      query.status =
        statusMatch[1].charAt(0).toUpperCase() +
        statusMatch[1].slice(1).toLowerCase();
    }

    // Match any keyword in the report's searchable fields.
    if (terms.length > 0) {
      query.$or = terms.map(term => {
        const regex = {
          $regex: escapeRegex(term),
          $options: "i"
        };

        return {
          $or: [
            { itemName: regex },
            { category: regex },
            { description: regex }
          ]
        };
      });
    }

    // Use the same actual results to calculate counts and format the answer.
    const reports = await Item.find(query)
      .select("itemName type category description location date status")
      .sort({ createdAt: -1 })
      .lean();

    const publicReports = reports.map(makePublicItem);

    console.log("CHAT SEARCH QUERY:", JSON.stringify(query));
    console.log("CHAT MATCHING REPORT COUNT:", publicReports.length);
    console.log(
      "CHAT MATCHING REPORTS:",
      JSON.stringify(publicReports, null, 2)
    );

    const reply = formatReportsAnswer(publicReports, text);

    return res.json({ reply });

  } catch (error) {
    console.error("CampusFind chat error:", error);

    if (
      error.name === "AbortError" ||
      error.name === "TimeoutError"
    ) {
      return res.status(504).json({
        error: "The AI took too long to respond. Please try again."
      });
    }

    return res.status(503).json({
      error: "Could not complete your request. Check the server logs."
    });
  }
});

module.exports = router;
