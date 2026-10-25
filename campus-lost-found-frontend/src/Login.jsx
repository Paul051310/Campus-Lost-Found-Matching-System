
import { useState } from "react";

const AUTH_URL = "http://localhost:5000/api/auth";

export default function Login({ onLoginSuccess, onCreateAccount }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${AUTH_URL}/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Login failed. Please try again."
        );
      }

      // The backend sets the HttpOnly login cookie.
      await onLoginSuccess();
    } catch (err) {
      setError(
        err.message ||
          "Cannot connect to the server. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.icon}>🔎</div>

        <h1 style={styles.title}>CampusFind</h1>
        <p style={styles.subtitle}>Lost &amp; Found System</p>

        <h2 style={styles.heading}>Welcome back</h2>
        <p style={styles.description}>
          Log in to access your campus lost and found dashboard.
        </p>

        {error && (
          <div role="alert" style={styles.error}>
            {error}
          </div>
        )}

        <label htmlFor="login-email" style={styles.label}>
          Email address
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          placeholder="Enter your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          style={styles.input}
        />

        <label htmlFor="login-password" style={styles.label}>
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          style={styles.input}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        <div style={styles.registerSection}>
          <span>Don't have an account? </span>
          <button
            type="button"
            onClick={onCreateAccount}
            style={styles.registerLink}
          >
            Create Account
          </button>
        </div>

        <p style={styles.note}>
          College Of Maasin accounts only. Student accounts must be approved
          by the administrator before logging in.
        </p>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box",
    background: "linear-gradient(135deg, #f5f3ff, #eef2ff)",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "32px",
    boxSizing: "border-box",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    boxShadow: "0 16px 45px rgba(49, 46, 129, 0.12)",
  },
  icon: {
    fontSize: "34px",
    textAlign: "center",
  },
  title: {
    margin: "10px 0 4px",
    textAlign: "center",
    color: "#312e81",
    fontSize: "30px",
  },
  subtitle: {
    margin: "0 0 30px",
    textAlign: "center",
    color: "#6b7280",
  },
  heading: {
    marginBottom: "8px",
    color: "#1f2937",
    fontSize: "24px",
  },
  description: {
    marginBottom: "22px",
    color: "#6b7280",
    lineHeight: 1.5,
  },
  label: {
    display: "block",
    margin: "16px 0 7px",
    color: "#374151",
    fontSize: "14px",
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    padding: "12px 13px",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "9px",
    fontSize: "15px",
    outlineColor: "#6366f1",
  },
  button: {
    width: "100%",
    marginTop: "24px",
    padding: "13px",
    border: "none",
    borderRadius: "9px",
    background: "#4f46e5",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "bold",
  },
  registerSection: {
    marginTop: "22px",
    textAlign: "center",
    color: "#77778e",
    fontSize: "14px",
  },
  registerLink: {
    border: "none",
    background: "none",
    color: "#6f5ce7",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "14px",
    padding: "4px",
  },
  error: {
    padding: "12px",
    borderRadius: "8px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  note: {
    marginTop: "20px",
    marginBottom: 0,
    color: "#6b7280",
    fontSize: "12px",
    lineHeight: 1.6,
    textAlign: "center",
  },
};
