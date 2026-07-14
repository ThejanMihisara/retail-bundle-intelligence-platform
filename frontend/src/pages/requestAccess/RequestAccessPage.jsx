import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { submitAccessRequest } from "../../services/accessRequestService";

const ROLES = [
  { value: "manager", label: "Manager — Full analytics access" },
  { value: "analyst", label: "Analyst — Read-only analytics" },
  { value: "viewer", label: "Viewer — Dashboard overview only" },
];

const RequestAccessPage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    department: "",
    requested_role: "analyst",
    reason: "",
  });

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      await submitAccessRequest(form);
      setSubmitted(true);
      toast.success("Access request submitted. An admin will review your request.");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--page-bg, linear-gradient(135deg, #060b18 0%, #0a1628 100%))" }}
    >
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--accent-green), var(--accent-cyan))", boxShadow: "0 0 24px rgba(16,185,129,0.4)" }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight" style={{ color: "white" }}>BundleMind</h1>
            <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "var(--accent-green)" }}>Retail Intelligence</p>
          </div>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(12,17,32,0.85)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }}
        >
          {submitted ? (
            /* Success State */
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <svg className="w-8 h-8" fill="none" stroke="var(--accent-green-text)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-white mb-2">Request Submitted!</h2>
              <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
                Your access request has been sent to the system administrator. You will receive login credentials once your request is approved.
              </p>
              <button
                onClick={() => navigate("/auth")}
                className="w-full h-11 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, var(--accent-green), var(--accent-cyan))", boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}
              >
                Back to Login
              </button>
            </div>
          ) : (
            /* Form */
            <>
              <div className="mb-7">
                <h2 className="text-base font-bold text-white">Request System Access</h2>
                <p className="text-[11px] mt-1" style={{ color: "#64748b" }}>
                  Fill in your details and an admin will review your request.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                      Full Name <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="h-10 px-3 rounded-xl text-sm font-semibold transition-all outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                      placeholder="John Smith"
                      value={form.name}
                      onChange={handleChange("name")}
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                      Email Address <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input
                      type="email"
                      className="h-10 px-3 rounded-xl text-sm font-semibold transition-all outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                      placeholder="you@company.com"
                      value={form.email}
                      onChange={handleChange("email")}
                      required
                    />
                  </div>

                  {/* Organization + Department */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Organization</label>
                      <input
                        type="text"
                        className="h-10 px-3 rounded-xl text-sm font-semibold transition-all outline-none"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                        placeholder="Retail Co."
                        value={form.organization}
                        onChange={handleChange("organization")}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Department</label>
                      <input
                        type="text"
                        className="h-10 px-3 rounded-xl text-sm font-semibold transition-all outline-none"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                        placeholder="Operations"
                        value={form.department}
                        onChange={handleChange("department")}
                      />
                    </div>
                  </div>

                  {/* Requested Role */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Requested Access Level</label>
                    <select
                      className="h-10 px-3 rounded-xl text-sm font-semibold transition-all outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                      value={form.requested_role}
                      onChange={handleChange("requested_role")}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value} style={{ background: "#0c1120" }}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reason */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Reason for Access</label>
                    <textarea
                      rows={3}
                      className="px-3 py-2.5 rounded-xl text-sm font-semibold transition-all outline-none resize-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                      placeholder="Briefly describe why you need access to BundleMind..."
                      value={form.reason}
                      onChange={handleChange("reason")}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-40 mt-2"
                  style={{ background: "linear-gradient(135deg, var(--accent-green), var(--accent-cyan))", boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}
                >
                  {submitting ? "Submitting..." : "Submit Access Request"}
                </button>

                <div className="text-center pt-2">
                  <button type="button" onClick={() => navigate("/auth")}
                    className="text-[11px] font-semibold transition-colors"
                    style={{ color: "#64748b" }}
                    onMouseEnter={(e) => { e.target.style.color = "var(--accent-green)"; }}
                    onMouseLeave={(e) => { e.target.style.color = "#64748b"; }}>
                    ← Back to Login
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestAccessPage;
