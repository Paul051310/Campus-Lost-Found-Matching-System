
import { useState } from "react";
import "./Chatbot.css";

const API_URL = "http://localhost:5000/api/chat";
const ITEMS_URL = "http://localhost:5000/api/items";

const SUGGESTED_QUESTIONS = [
  "How can I report a lost item?",
  "How do I report a found item?",
  "How many reports are there?",
  "How many lost and found items are reported?",
  "How can I find a blue wallet?",
  "Show me all lost items",
  "Show me all found items",
  "What are the possible matches?",
  "How do possible matches work?",
  "How can I confirm a match?",
  "How can I edit or delete a report?",
  "What information do I need to report an item?"
];

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getItemType(item) {
  return normalize(item.type);
}

function formatItem(item, index) {
  return [
    `${index + 1}. ${item.itemName || item.name || "Unnamed item"}`,
    `Category: ${item.category || "Not specified"}`,
    `Location: ${item.location || "Not specified"}`,
    `Date: ${
      item.date
        ? new Date(item.date).toLocaleDateString()
        : "Not specified"
    }`,
    `Status: ${item.status || "Open"}`,
    item.description ? `Description: ${item.description}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function detectReportRequest(text) {
  const question = normalize(text);

  const asksForList =
    /\b(show|list|display|view|find|get|give me|what are|which are)\b/.test(
      question
    ) || /\ball\b/.test(question);

  if (
    asksForList &&
    /\blost\b/.test(question) &&
    /\b(items?|reports?|things?)\b/.test(question)
  ) {
    return "Lost";
  }

  if (
    asksForList &&
    /\b(found|recovered)\b/.test(question) &&
    /\b(items?|reports?|things?)\b/.test(question)
  ) {
    return "Found";
  }

  if (
    /\b(how many|count|total number)\b/.test(question) &&
    /\b(reports?|items?)\b/.test(question)
  ) {
    return "Count";
  }

  return null;
}

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  return { message: text };
}

function getErrorMessage(status, data) {
  if (status === 401) {
    return "Your session has expired or you are not logged in. Please log in again.";
  }

  if (status === 403) {
    return data.message || "Your account does not have permission to access this feature.";
  }

  if (status === 404) {
    return "The requested API endpoint was not found. Check the backend route.";
  }

  if (status >= 500) {
    return data.message || data.error || "The backend encountered an error. Check the backend terminal.";
  }

  return data.message || data.error || "The request could not be completed.";
}

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm CampusFind AI. Choose a suggested question below or type your own question."
    }
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(question) {
    const text = (question ?? input).trim();

    if (!text || loading) return;

    const history = messages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content
    }));

    setMessages((current) => [
      ...current,
      { role: "user", content: text }
    ]);

    setInput("");
    setError("");
    setLoading(true);

    try {
      const reportRequest = detectReportRequest(text);
      let reply;

      if (reportRequest) {
        const response = await fetch(ITEMS_URL, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json"
          }
        });

        const data = await readResponse(response);

        if (!response.ok) {
          throw new Error(getErrorMessage(response.status, data));
        }

        const items = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
            ? data.items
            : Array.isArray(data.reports)
              ? data.reports
              : [];

        if (reportRequest === "Count") {
          const lost = items.filter(
            (item) => getItemType(item) === "lost"
          ).length;

          const found = items.filter(
            (item) => getItemType(item) === "found"
          ).length;

          reply =
            `Here is the current CampusFind report count:\n\n` +
            `Total reports: ${items.length}\n` +
            `Lost items: ${lost}\n` +
            `Found items: ${found}`;
        } else {
          const matchingItems = items.filter(
            (item) =>
              getItemType(item) === normalize(reportRequest)
          );

          if (matchingItems.length === 0) {
            reply =
              `There are currently no ${reportRequest.toLowerCase()} item reports in the database.`;
          } else {
            reply =
              `Here are ${matchingItems.length} ${reportRequest.toLowerCase()} item report(s) in CampusFind:\n\n` +
              matchingItems.map((item, index) =>
                formatItem(item, index)
              ).join("\n\n");
          }
        }
      } else {
        const response = await fetch(API_URL, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            message: text,
            history
          })
        });

        const data = await readResponse(response);

        if (!response.ok) {
          throw new Error(getErrorMessage(response.status, data));
        }

        if (!data.reply) {
          throw new Error(
            data.message ||
              data.error ||
              "The AI server returned an empty response."
          );
        }

        reply = data.reply;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: reply
        }
      ]);
    } catch (err) {
      console.error("CampusFind chatbot request failed:", err);

      let message = err.message || "The request failed.";

      if (
        err instanceof TypeError &&
        /fetch/i.test(err.message)
      ) {
        message =
          "Cannot connect to the backend. Check that the server is running at http://localhost:5000 and that CORS allows your frontend address.";
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="campus-chat">
      <header className="campus-chat-header">
        <div className="campus-chat-avatar">✦</div>

        <div>
          <h2>CampusFind AI</h2>
          <p>Your lost-and-found assistant</p>
        </div>

        <span className="campus-chat-status">
          ● Online
        </span>
      </header>

      <div
        className="campus-chat-messages"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`campus-chat-row ${
              message.role === "user" ? "is-user" : "is-ai"
            }`}
          >
            <div className="campus-chat-bubble">
              <span style={{ whiteSpace: "pre-wrap" }}>
                {message.content}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="campus-chat-row is-ai">
            <div className="campus-chat-bubble">
              CampusFind AI is thinking...
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="campus-chat-error" role="alert">
          {error}
        </p>
      )}

      <div className="campus-chat-suggestions">
        <h3>Suggested Questions</h3>
        <p>Choose a question to get started.</p>

        <div className="campus-chat-question-list">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              className="campus-chat-question"
              onClick={() => sendMessage(question)}
              disabled={loading}
            >
              <span>{question}</span>
              <span className="campus-chat-question-arrow">
                →
              </span>
            </button>
          ))}
        </div>
      </div>

      <form
        className="campus-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask CampusFind AI..."
          maxLength={1000}
          disabled={loading}
          aria-label="Your message"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
        >
          {loading ? "..." : "Send"}
        </button>
      </form>

      <p className="campus-chat-disclaimer">
        AI suggestions may be inaccurate. Confirm possible
        matches with your campus administrator.
      </p>
    </section>
  );
}
