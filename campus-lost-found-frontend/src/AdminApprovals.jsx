
import { useCallback, useEffect, useState } from "react";
import "./AdminApprovals.css";

const AUTH_URL = "http://localhost:5000/api/auth";

export default function AdminApprovals() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${AUTH_URL}/pending`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load students.");
      }

      setStudents(data.students || []);
    } catch (err) {
      setError(err.message || "Unable to load pending students.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  async function approveStudent(student) {
    const confirmed = window.confirm(
      `Approve ${student.fullName}'s CampusFind account?`
    );

    if (!confirmed) return;

    setApprovingId(student.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${AUTH_URL}/${student.id}/approve`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to approve student.");
      }

      setStudents((current) =>
        current.filter((item) => item.id !== student.id)
      );

      setSuccess(`${student.fullName} has been approved successfully.`);
    } catch (err) {
      setError(err.message || "Approval failed. Please try again.");
    } finally {
      setApprovingId("");
    }
  }

  function goToDashboard() {
    // Switch the view without logging the admin out.
    window.dispatchEvent(new Event("campusfind:show-dashboard"));
  }

  return (
    <main className="admin-approvals">
      <header className="approvals-header">
        <div>
          <span className="approvals-eyebrow">
            CAMPUSFIND ADMINISTRATION
          </span>
          <h1>Student Approvals</h1>
          <p>Review new student registrations before granting access.</p>
        </div>

        <div className="approvals-header-actions">
          <button
            type="button"
            className="approvals-back"
            onClick={goToDashboard}
          >
            ← Back to Main Page
          </button>

          <button
            type="button"
            className="approvals-refresh"
            onClick={loadStudents}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      <section className="approvals-summary">
        <div className="approvals-summary-icon">♙</div>
        <div>
          <span>Pending registrations</span>
          <strong>{students.length}</strong>
        </div>
      </section>

      {error && (
        <div className="approvals-alert approvals-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="approvals-alert approvals-success" role="status">
          {success}
        </div>
      )}

      <section className="approvals-panel">
        <div className="approvals-panel-heading">
          <div>
            <h2>Registration requests</h2>
            <p>Only approve students whose details you have verified.</p>
          </div>
        </div>

        {loading ? (
          <div className="approvals-empty">
            Loading student registrations...
          </div>
        ) : students.length === 0 ? (
          <div className="approvals-empty">
            <span className="approvals-empty-icon">✓</span>
            <h3>All caught up!</h3>
            <p>There are no pending student registrations right now.</p>
          </div>
        ) : (
          <div className="approvals-table-wrapper">
            <table className="approvals-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Course / Year</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td data-label="Student">
                      <strong>{student.fullName}</strong>
                    </td>
                    <td data-label="Student ID">{student.studentId}</td>
                    <td data-label="Course / Year">{student.courseYear}</td>
                    <td data-label="Email">{student.email}</td>
                    <td data-label="Status">
                      <span className="approvals-status">Pending</span>
                    </td>
                    <td data-label="Action">
                      <button
                        type="button"
                        className="approvals-approve"
                        onClick={() => approveStudent(student)}
                        disabled={Boolean(approvingId)}
                      >
                        {approvingId === student.id
                          ? "Approving..."
                          : "Approve"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
