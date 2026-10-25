
import { useState } from "react";

const AUTH_URL = "http://localhost:5000/api/auth";

export default function Register({ onBackToLogin }) {
  const [form, setForm] = useState({
    fullName: "",
    studentId: "",
    courseYear: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${AUTH_URL}/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          studentId: form.studentId.trim(),
          courseYear: form.courseYear.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Registration failed. Please try again."
        );
      }

      setRegistered(true);
      setMessage(
        data.message ||
          "Registration successful! Your account is awaiting administrator approval."
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to CampusFind. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "1px solid #d9d8ee",
    borderRadius: "10px",
    fontSize: "14px",
    outlineColor: "#7664e8",
    background: "#ffffff",
    color: "#20213d",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "7px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#292943",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 16px",
        boxSizing: "border-box",
        background:
          "linear-gradient(135deg, #eef0ff 0%, #f8f7ff 55%, #e7e9ff 100%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "490px",
          padding: "32px",
          boxSizing: "border-box",
          background: "#ffffff",
          borderRadius: "22px",
          boxShadow: "0 18px 55px rgba(36, 31, 91, 0.13)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "26px" }}>
          <div
            style={{
              width: "58px",
              height: "58px",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 14px",
              borderRadius: "17px",
              background: "#7561ed",
              fontSize: "29px",
            }}
          >
            🔎
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              color: "#191a38",
              fontSize: "29px",
            }}
          >
            Create Account
          </h1>

          <p style={{ margin: 0, color: "#77778e", fontSize: "14px" }}>
            Join CampusFind at College Of Maasin
          </p>
        </div>

        {registered ? (
          <div>
            <div
              role="status"
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "#eefaf2",
                color: "#17683b",
                lineHeight: 1.6,
                fontSize: "14px",
              }}
            >
              <strong>Registration submitted!</strong>
              <p>{message}</p>
              Your account must be approved by the administrator before you
              can log in.
            </div>

            <button
              type="button"
              onClick={onBackToLogin}
              style={{
                ...inputStyle,
                marginTop: "18px",
                background: "#6f5ce7",
                color: "#ffffff",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle} htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
                autoComplete="name"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle} htmlFor="studentId">
                Student ID
              </label>
              <input
                id="studentId"
                name="studentId"
                value={form.studentId}
                onChange={handleChange}
                placeholder="Enter your student ID"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle} htmlFor="courseYear">
                Course and Year
              </label>
              <input
                id="courseYear"
                name="courseYear"
                value={form.courseYear}
                onChange={handleChange}
                placeholder="e.g. BSIT - 2nd Year"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle} htmlFor="email">
                School Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your email address"
                autoComplete="email"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={labelStyle} htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Enter your password again"
                autoComplete="new-password"
                style={inputStyle}
                required
              />
            </div>

            {error && (
              <p
                role="alert"
                style={{
                  padding: "11px",
                  borderRadius: "9px",
                  background: "#fff0f0",
                  color: "#b42318",
                  fontSize: "13px",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...inputStyle,
                background: loading ? "#a9a1e8" : "#6f5ce7",
                color: "#ffffff",
                border: "none",
                fontWeight: "bold",
                cursor: loading ? "wait" : "pointer",
                padding: "14px",
              }}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            <p
              style={{
                marginTop: "18px",
                textAlign: "center",
                fontSize: "13px",
                color: "#77778e",
                lineHeight: 1.6,
              }}
            >
              By registering, you agree to wait for administrator approval
              before accessing CampusFind.
            </p>
          </form>
        )}

        <div
          style={{
            marginTop: "22px",
            paddingTop: "18px",
            borderTop: "1px solid #eeeeF6",
            textAlign: "center",
            fontSize: "14px",
            color: "#66667e",
          }}
        >
          Already have an account?{" "}
          <button
            type="button"
            onClick={onBackToLogin}
            style={{
              border: "none",
              background: "none",
              color: "#6f5ce7",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Log in
          </button>
        </div>
      </section>
    </main>
  );
}
