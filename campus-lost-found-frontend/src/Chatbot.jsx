
import { useState } from "react";
import "./Chatbot.css";

const API_URL = "http://localhost:5000/api/chat";

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm CampusFind AI. Tell me about your lost or found item, and I'll help you figure out what to do next."
    }
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event) {
    event.preventDefault();

    const text = input.trim();
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
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          history
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to contact CampusFind AI.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply
        }
      ]);
    } catch (err) {
      setError(
        err.message || "Connection failed. Check your server and Ollama."
      );
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
        <span className="campus-chat-status">● Online</span>
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
              {message.content}
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

      <form className="campus-chat-form" onSubmit={sendMessage}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Describe your lost or found item..."
          maxLength={1000}
          disabled={loading}
          aria-label="Your message"
        />

        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? "..." : "Send"}
        </button>
      </form>

      <p className="campus-chat-disclaimer">
        AI suggestions may be inaccurate. Confirm possible matches with
        your campus administrator.
      </p>
    </section>
  );
}
