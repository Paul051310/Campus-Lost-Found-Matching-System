import { useState } from "react";

   import { SERVER_URL } from "./config";
   const AUTH_URL = `${SERVER_URL}/api/auth`;

// Send JSON to the server and return the reply, or throw a readable error.
async function postJson(path, body) {
  const response = await fetch(`${AUTH_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
      data.message ||
        data.error ||
        "Something went wrong. Please try again."
    );
  }

  return data;
}

export default function Login({ onLoginSuccess, onCreateAccount }) {
  // "login", "findEmail", or "forgotPassword"
  const [view, setView] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailHint, setEmailHint] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function switchView(nextView) {
    setView(nextView);
    setError("");
    setNotice("");
    setEmailHint("");
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      await postJson("/login", { email: email.trim(), password });

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

  async function handleFindEmail(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setEmailHint("");

    try {
      const data = await postJson("/find-email", {
        studentId: studentId.trim(),
        fullName: fullName.trim(),
      });

      setEmailHint(data.emailHint || "");
    } catch (err) {
      setError(
        err.message ||
          "Cannot connect to the server. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const data = await postJson("/forgot-password", {
        email: email.trim(),
      });

      setNotice(
        data.message ||
          "Your request was sent to the administrator."
      );
    } catch (err) {
      setError(
        err.message ||
          "Cannot connect to the server. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  const titles = {
    login: {
      heading: "Welcome back",
      text: "Log in to access your campus lost and found dashboard.",
    },
    findEmail: {
      heading: "Find your email",
      text: "Enter your student ID and full name exactly as you registered. We will show a hidden hint of your email.",
    },
    forgotPassword: {
      heading: "Forgot your password?",
      text: "Enter your email. The administrator will be notified and will set a new password for you.",
    },
  };

  return (
    <main className="cf-page">
      <style>{css}</style>

      <aside className="cf-brand" aria-hidden="true">
        <div className="cf-brand-top">
          <div className="cf-logo">🔎</div>
          <span className="cf-brand-name">CampusFind</span>
        </div>

        <div className="cf-brand-body">
          <h2>Every item deserves to find its way home.</h2>
          <p>
            Report lost and found belongings and reconnect them with
            their owners across campus.
          </p>

          <ul>
            <li>Report a lost or found item in minutes</li>
            <li>Smart match suggestions between reports</li>
            <li>Secure, administrator-approved accounts</li>
          </ul>
        </div>

        <div className="cf-brand-footer">College Of Maasin</div>
      </aside>

      <section className="cf-panel">
        <div className="cf-card">
          <div className="cf-mobile-brand">
            <div className="cf-logo">🔎</div>
            <span className="cf-brand-name">CampusFind</span>
          </div>

          <h1 className="cf-heading">{titles[view].heading}</h1>
          <p className="cf-description">{titles[view].text}</p>

          {error && (
            <div role="alert" className="cf-alert cf-alert-error">
              {error}
            </div>
          )}

          {notice && (
            <div role="status" className="cf-alert cf-alert-success">
              {notice}
            </div>
          )}

          {/* ---------- LOG IN ---------- */}
          {view === "login" && (
            <form onSubmit={handleLogin}>
              <label htmlFor="login-email" className="cf-label">
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
                className="cf-input"
              />

              <label htmlFor="login-password" className="cf-label">
                Password
              </label>
              <div className="cf-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="cf-input cf-input-password"
                />
                <button
                  type="button"
                  className="cf-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <div className="cf-recovery-links">
                <button
                  type="button"
                  className="cf-link"
                  onClick={() => switchView("findEmail")}
                >
                  Forgot email?
                </button>

                <button
                  type="button"
                  className="cf-link"
                  onClick={() => switchView("forgotPassword")}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="cf-button"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>

              <div className="cf-footer-row">
                <span>Don't have an account?</span>
                <button
                  type="button"
                  onClick={onCreateAccount}
                  className="cf-link cf-link-bold"
                >
                  Create Account
                </button>
              </div>

              <p className="cf-note">
                College Of Maasin accounts only. Student accounts must be
                approved by the administrator before logging in.
              </p>
            </form>
          )}

          {/* ---------- FORGOT EMAIL ---------- */}
          {view === "findEmail" && (
            <form onSubmit={handleFindEmail}>
              <label htmlFor="find-student-id" className="cf-label">
                Student ID
              </label>
              <input
                id="find-student-id"
                type="text"
                placeholder="Enter your student ID"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                required
                className="cf-input"
              />

              <label htmlFor="find-full-name" className="cf-label">
                Full name
              </label>
              <input
                id="find-full-name"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="cf-input"
              />

              {emailHint && (
                <div role="status" className="cf-alert cf-alert-success">
                  Your email looks like: <strong>{emailHint}</strong>
                  <br />
                  Use the full address on the login page.
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="cf-button"
              >
                {loading ? "Searching..." : "Find my email"}
              </button>

              <div className="cf-footer-row">
                <button
                  type="button"
                  className="cf-link cf-link-bold"
                  onClick={() => switchView("login")}
                >
                  ← Back to log in
                </button>

                <button
                  type="button"
                  className="cf-link"
                  onClick={() => switchView("forgotPassword")}
                >
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {/* ---------- FORGOT PASSWORD ---------- */}
          {view === "forgotPassword" && (
            <form onSubmit={handleForgotPassword}>
              <label htmlFor="forgot-email" className="cf-label">
                Email address
              </label>
              <input
                id="forgot-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="cf-input"
              />

              <button
                type="submit"
                disabled={loading}
                className="cf-button"
              >
                {loading ? "Sending..." : "Send request to administrator"}
              </button>

              <div className="cf-footer-row">
                <button
                  type="button"
                  className="cf-link cf-link-bold"
                  onClick={() => switchView("login")}
                >
                  ← Back to log in
                </button>

                <button
                  type="button"
                  className="cf-link"
                  onClick={() => switchView("findEmail")}
                >
                  Forgot email?
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

const css = `
.cf-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(340px, 1fr) minmax(380px, 1fr);
  background: #f8fafc;
  font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
  color: #0f172a;
}

/* ----- Left brand panel ----- */
.cf-brand {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 56px;
  color: #ffffff;
  background:
    radial-gradient(circle at 20% 15%, rgba(129, 140, 248, 0.45), transparent 45%),
    linear-gradient(160deg, #1e1b4b 0%, #312e81 55%, #4338ca 100%);
}

.cf-brand-top,
.cf-mobile-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cf-logo {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  font-size: 20px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.16);
}

.cf-brand-name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.cf-brand-body h2 {
  margin: 0 0 14px;
  max-width: 420px;
  font-size: 34px;
  line-height: 1.2;
  font-weight: 700;
}

.cf-brand-body p {
  margin: 0 0 28px;
  max-width: 420px;
  color: #c7d2fe;
  font-size: 16px;
  line-height: 1.6;
}

.cf-brand-body ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.cf-brand-body li {
  position: relative;
  margin-bottom: 12px;
  padding-left: 28px;
  color: #e0e7ff;
  font-size: 15px;
}

.cf-brand-body li::before {
  content: "✓";
  position: absolute;
  left: 0;
  top: 0;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  font-size: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
}

.cf-brand-footer {
  color: #a5b4fc;
  font-size: 13px;
}

/* ----- Right form panel ----- */
.cf-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
}

.cf-card {
  width: 100%;
  max-width: 420px;
}

.cf-mobile-brand {
  display: none;
  margin-bottom: 28px;
  color: #312e81;
}

.cf-mobile-brand .cf-logo {
  background: #eef2ff;
}

.cf-heading {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}

.cf-description {
  margin: 0 0 24px;
  color: #64748b;
  font-size: 15px;
  line-height: 1.6;
}

.cf-label {
  display: block;
  margin: 18px 0 7px;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}

.cf-input {
  width: 100%;
  padding: 12px 14px;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #ffffff;
  color: #0f172a;
  font-size: 15px;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.cf-input::placeholder {
  color: #94a3b8;
}

.cf-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.14);
}

.cf-password-wrap {
  position: relative;
}

.cf-input-password {
  padding-right: 64px;
}

.cf-toggle {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  padding: 6px 8px;
  border: none;
  background: none;
  color: #4f46e5;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.cf-recovery-links {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.cf-button {
  width: 100%;
  margin-top: 22px;
  padding: 13px;
  border: none;
  border-radius: 10px;
  background: #4f46e5;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.28);
  transition: background 0.15s ease, transform 0.1s ease;
}

.cf-button:hover:not(:disabled) {
  background: #4338ca;
}

.cf-button:active:not(:disabled) {
  transform: translateY(1px);
}

.cf-button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.cf-link {
  padding: 4px 0;
  border: none;
  background: none;
  color: #4f46e5;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
}

.cf-link:hover {
  text-decoration: underline;
}

.cf-link-bold {
  font-weight: 600;
}

.cf-footer-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
  color: #64748b;
  font-size: 14px;
}

.cf-note {
  margin: 20px 0 0;
  padding-top: 18px;
  border-top: 1px solid #e2e8f0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

.cf-alert {
  margin-bottom: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
}

.cf-alert-error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.cf-alert-success {
  margin-top: 16px;
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

/* ----- Phones and small screens ----- */
@media (max-width: 900px) {
  .cf-page {
    grid-template-columns: 1fr;
  }

  .cf-brand {
    display: none;
  }

  .cf-mobile-brand {
    display: flex;
  }
}
`;
