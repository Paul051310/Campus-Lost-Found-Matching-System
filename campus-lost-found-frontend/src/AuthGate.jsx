import { useCallback, useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import Login from "./Login";
import Register from "./Register";
import AdminApprovals from "./AdminApprovals";

const AUTH_URL = "http://localhost:5000/api/auth";
const CAMPUS_ID = "college-of-maasin";

export default function AuthGate() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [adminView, setAdminView] = useState("approvals");

  // Check the user's login session.
  const checkSession = useCallback(async () => {
    setChecking(true);
    setCheckError("");

    try {
      const response = await fetch(`${AUTH_URL}/me`, {
        method: "GET",
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        setUser(null);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Session check failed (${response.status}).`
        );
      }

      const account = data.user || data;

      // Allow access only to the correct campus.
      if (account.campusId !== CAMPUS_ID) {
        setUser(null);
        setCheckError("Access is restricted to College Of Maasin.");
        return;
      }

      // Check account approval status.
      if (account.status !== "approved") {
        setUser(null);

        setCheckError(
          account.status === "pending"
            ? "Your account is waiting for administrator approval."
            : "Your account has not been approved. Contact the administrator."
        );

        return;
      }

      // Only approved students and administrators can access the app.
      if (!["admin", "student"].includes(account.role)) {
        setUser(null);
        setCheckError("Your account does not have an authorized role.");
        return;
      }

      setUser(account);

      // Administrators initially see the approvals page.
      setAdminView(
        account.role === "admin" ? "approvals" : "dashboard"
      );
    } catch (err) {
      setUser(null);

      setCheckError(
        err.message ||
          "Cannot connect to the backend. Make sure the server is running."
      );
    } finally {
      setChecking(false);
    }
  }, []);

  // Check the existing session when AuthGate loads.
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Handle dashboard navigation, approvals navigation, and logout events.
  useEffect(() => {
    function handleShowDashboard() {
      setAdminView("dashboard");
    }

    function handleShowApprovals() {
      setAdminView("approvals");
    }

    async function handleLogout() {
      // Clear the local session immediately.
      setUser(null);
      setShowRegister(false);
      setAdminView("approvals");
      setCheckError("");

      // Invalidate the server-side session.
      try {
        const response = await fetch(`${AUTH_URL}/logout`, {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          console.error(
            "The server could not confirm logout. Check the backend logout route."
          );
        }
      } catch (error) {
        console.error(
          "Could not contact the logout endpoint:",
          error
        );
      }
    }

    window.addEventListener(
      "campusfind:show-dashboard",
      handleShowDashboard
    );

    window.addEventListener(
      "campusfind:show-approvals",
      handleShowApprovals
    );

    window.addEventListener(
      "campusfind:logout",
      handleLogout
    );

    return () => {
      window.removeEventListener(
        "campusfind:show-dashboard",
        handleShowDashboard
      );

      window.removeEventListener(
        "campusfind:show-approvals",
        handleShowApprovals
      );

      window.removeEventListener(
        "campusfind:logout",
        handleLogout
      );
    };
  }, []);

  // Handle successful login.
  function handleLoginSuccess() {
    setShowRegister(false);
    checkSession();
  }

  // Handle successful registration.
  function handleRegistrationSuccess() {
    setShowRegister(false);

    setCheckError(
      "Registration submitted! Please wait for administrator approval before logging in."
    );
  }

  // Display a loading message while checking the session.
  if (checking) {
    return (
      <main style={styles.messagePage}>
        <p>Checking your CampusFind session...</p>
      </main>
    );
  }

  // Display the application after successful authentication.
  if (user) {
    // Administrators initially see the approvals page.
    if (user.role === "admin" && adminView === "approvals") {
      return <AdminApprovals />;
    }

    // Wrap the application with BrowserRouter to enable separate pages.
    return (
      <BrowserRouter>
        <App
          user={user}
          isAdmin={user.role === "admin"}
        />
      </BrowserRouter>
    );
  }

  // Display the registration page when requested.
  if (showRegister) {
    return (
      <>
        {checkError && (
          <div style={styles.notice} role="alert">
            {checkError}
          </div>
        )}

        <Register
          onBackToLogin={() => {
            setShowRegister(false);
            setCheckError("");
          }}
          onRegistrationSuccess={handleRegistrationSuccess}
        />
      </>
    );
  }

  // Display the login page by default.
  return (
    <>
      {checkError && (
        <div style={styles.notice} role="alert">
          {checkError}
        </div>
      )}

      <Login
        onLoginSuccess={handleLoginSuccess}
        onCreateAccount={() => {
          setCheckError("");
          setShowRegister(true);
        }}
      />
    </>
  );
}

const styles = {
  messagePage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily: "Arial, sans-serif",
    color: "#312e81",
  },

  notice: {
    padding: "12px 20px",
    background: "#fff7ed",
    color: "#9a3412",
    textAlign: "center",
    fontFamily: "Arial, sans-serif",
  },
};