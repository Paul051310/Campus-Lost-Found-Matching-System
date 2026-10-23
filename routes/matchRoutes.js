
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Item = require("../models/Item");

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const MODEL_NAME = "llama3.2:1b";

const MAX_CANDIDATES = 10;
const MIN_MATCH_SCORE = 30;

// Only expose information needed for matching.
// Never send contact information to Ollama.
function publicItem(item) {
  return {
    _id: String(item._id),
    itemName: item.itemName || "",
    type: item.type,
    category: item.category || "",
    description: item.description || "",
    location: item.location || "",
    date: item.date,
    status: item.status
  };
}

// Escape special regex characters before searching MongoDB.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Extract useful words from the report.
function extractKeywords(item) {
  const text = [
    item.itemName,
    item.category,
    item.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that",
    "this", "was", "were", "has", "have", "item",
    "lost", "found", "its", "near", "very", "other",
    "items", "belongings"
  ]);

  return [...new Set(text.match(/[a-z0-9]+/g) || [])]
    .filter(word => word.length >= 3 && !stopWords.has(word))
    .slice(0, 12);
}

// POST /api/matches/:itemId
// Find possible Lost and Found matches.
router.post("/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        message: "Invalid item ID."
      });
    }

    const source = await Item.findById(itemId).lean();

    if (!source) {
      return res.status(404).json({
        message: "The selected report was not found."
      });
    }

    if (source.status !== "Open") {
      return res.status(400).json({
        message: "Only Open reports can be matched.",
        status: source.status
      });
    }

    const oppositeType = source.type === "Lost" ? "Found" : "Lost";

    const keywords = extractKeywords(source);

    // Always restrict candidates to the opposite report type
    // and Open status.
    const candidateQuery = {
      type: oppositeType,
      status: "Open",
      _id: { $ne: source._id }
    };

    // Search across names, categories, descriptions, and locations.
    if (keywords.length > 0) {
      candidateQuery.$or = keywords.map(keyword => {
        const regex = {
          $regex: escapeRegex(keyword),
          $options: "i"
        };

        return {
          $or: [
            { itemName: regex },
            { category: regex },
            { description: regex },
            { location: regex }
          ]
        };
      });
    }

    let candidates = await Item.find(candidateQuery)
      .sort({ createdAt: -1 })
      .limit(MAX_CANDIDATES)
      .lean();

    // If keyword filtering returns no candidates, retrieve recent
    // Open reports of the opposite type for AI comparison.
    if (candidates.length === 0) {
      candidates = await Item.find({
        type: oppositeType,
        status: "Open",
        _id: { $ne: source._id }
      })
        .sort({ createdAt: -1 })
        .limit(MAX_CANDIDATES)
        .lean();
    }

    if (candidates.length === 0) {
      return res.json({
        source: publicItem(source),
        matches: [],
        message: `No open ${oppositeType.toLowerCase()} reports are available to compare.`
      });
    }

    const sourceData = publicItem(source);
    const candidateData = candidates.map(publicItem);

    const prompt = `
You compare Lost and Found reports for a campus system.

SOURCE REPORT:
${JSON.stringify(sourceData)}

CANDIDATE REPORTS:
${JSON.stringify(candidateData)}

Compare each candidate against the source report.

Consider:
- Whether the item names identify the same kind of object.
- Category compatibility.
- Brand, model, color, and distinctive features when provided.
- Descriptions, location, and date as supporting evidence.

Scoring guidance:
- 0-10: clearly different items or no meaningful evidence.
- 11-29: weak or uncertain similarity.
- 30-59: some meaningful evidence of a possible match.
- 60-84: strong similarities in the available details.
- 85-100: very strong similarities across multiple details.

Rules:
- A wallet and a water bottle are different items.
- A wallet and a student ID card are different items.
- Different item identities must receive a score from 0 to 10.
- A shared location, date, or broad category alone is not enough.
- Missing details are unknown; never invent information.
- Compare only the candidates supplied.
- Return each candidate at most once.
- Use the exact candidate MongoDB ID.
- These are suggestions, never confirmed matches.
- Return ONLY valid JSON using this structure:

{
  "matches": [
    {
      "itemId": "candidate MongoDB ID",
      "score": 0,
      "reason": "Brief explanation based on supplied details"
    }
  ]
}
`;

    const aiResponse = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        stream: false,
        format: "json",
        messages: [
          {
            role: "system",
            content:
              "You compare lost and found reports carefully. Follow the scoring rules and return valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        options: {
          temperature: 0
        }
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!aiResponse.ok) {
      console.error(
        "Ollama HTTP error:",
        aiResponse.status,
        await aiResponse.text()
      );

      return res.status(502).json({
        message: "Ollama could not compare the reports. Please try again."
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.message?.content;

    if (!content) {
      return res.status(502).json({
        message: "Ollama returned an empty matching result."
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("Invalid Ollama matching JSON:", content);

      return res.status(502).json({
        message: "Ollama returned an invalid matching result. Please try again."
      });
    }

    // Accept only IDs that were actually sent to Ollama.
    const candidateMap = new Map(
      candidateData.map(item => [item._id, item])
    );

    const allowedIds = new Set(candidateMap.keys());

    const matches = (
      Array.isArray(parsed.matches) ? parsed.matches : []
    )
      .filter(match =>
        match &&
        allowedIds.has(String(match.itemId))
      )
      .map(match => {
        const rawScore = Number(match.score);

        const score = Number.isFinite(rawScore)
          ? Math.max(0, Math.min(100, rawScore))
          : 0;

        return {
          item: candidateMap.get(String(match.itemId)),
          score,
          reason:
            typeof match.reason === "string"
              ? match.reason.slice(0, 300)
              : "Similarity needs manual review."
        };
      })
      // Remove weak suggestions.
      .filter(match => match.score >= MIN_MATCH_SCORE)
      .sort((a, b) => b.score - a.score);

    return res.json({
      source: sourceData,
      matches,
      message: matches.length > 0
        ? "Possible matches are suggestions only. Review the details before confirming a match."
        : "No likely matches were identified among the candidate reports."
    });

  } catch (error) {
    console.error("CampusFind matching error:", error);

    if (
      error.name === "AbortError" ||
      error.name === "TimeoutError"
    ) {
      return res.status(504).json({
        message: "Ollama took too long to compare the reports. Please try again."
      });
    }

    if (error.name === "TypeError" && /fetch/i.test(error.message)) {
      return res.status(502).json({
        message: "Cannot connect to Ollama. Check that Ollama is running."
      });
    }

    return res.status(500).json({
      message: "The matching request failed. Check the backend terminal."
    });
  }
});

module.exports = router;
