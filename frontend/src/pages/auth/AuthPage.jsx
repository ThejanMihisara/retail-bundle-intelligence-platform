import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login as loginApi } from "../../services/authService";
import { submitAccessRequest } from "../../services/accessRequestService";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import authBg from "../../assets/auth-bg.png";

const inputClass = "h-11 w-full rounded-xl border px-4 text-sm outline-none focus:border-emerald-400 transition-all duration-200 auth-input";

const ROLES = [
  { value: "manager", label: "Manager - Full analytics access" },
  { value: "analyst", label: "Analyst - Read-only analytics" },
  { value: "viewer", label: "Viewer - Dashboard overview only" },
];

const AuthPage = ({ initialTab = "login" }) => {
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [requestForm, setRequestForm] = useState({
    name: "",
    email: "",
    organization: "",
    department: "",
    requested_role: "analyst",
    reason: "",
  });
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await loginApi(loginForm.email, loginForm.password);
      login(res.data.access_token);
      toast.success("Welcome back! Signed in successfully.");
      navigate("/dashboard");
    } catch {
      toast.error("Invalid credentials or account pending approval.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChange = (field) => (event) => {
    setRequestForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const submitAccess = async (event) => {
    event.preventDefault();
    if (!requestForm.name || !requestForm.email) {
      toast.error("Name and email are required.");
      return;
    }
    setLoading(true);
    try {
      await submitAccessRequest(requestForm);
      setRequestSubmitted(true);
      toast.success("Access request submitted. An admin will review your request.");
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  const showLogin = tab === "login";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${authBg})` }}
    >
      <div className="absolute inset-0 bg-slate-950/45 pointer-events-none"></div>

      <button
        onClick={toggleTheme}
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className="absolute top-5 right-5 z-20 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
        style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "white", backdropFilter: "blur(8px)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
      >
        {theme === "dark" ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      <div className="w-full max-w-[480px] z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.45)]">
            BundleMind
          </h1>
          <p className="mt-2 text-sm text-emerald-300 font-semibold tracking-wide drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
            supermarket predictive retail analytics portal
          </p>
        </div>

        <div className="relative p-1 rounded-2xl flex mb-6 overflow-hidden backdrop-blur-md auth-tab-bg">
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out auth-tab-active ${
              showLogin ? "left-1.5" : "left-[calc(50%+4.5px)]"
            }`}
          />
          <button
            type="button"
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-colors duration-300 z-10 ${
              showLogin ? "auth-tab-text-active" : "auth-tab-text-inactive hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setTab("login")}
          >
            Login Access
          </button>
          <button
            type="button"
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-colors duration-300 z-10 ${
              !showLogin ? "auth-tab-text-active" : "auth-tab-text-inactive hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setTab("request")}
          >
            Request Access
          </button>
        </div>

        {showLogin ? (
          <form onSubmit={submitLogin} className="backdrop-blur-xl p-8 rounded-3xl shadow-2xl flex flex-col gap-4 animate-fade-in auth-card">
            <div>
              <h2 className="text-xl font-bold mb-1">Welcome Back</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Sign in to continue to BundleMind</p>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-bold uppercase tracking-wider auth-label">Email Address</label>
              <input
                className={inputClass}
                type="email"
                placeholder="example@gmail.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider auth-label">Password</label>
              <input
                className={inputClass}
                type="password"
                placeholder="************"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              className="mt-4 h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center"
              disabled={loading}
            >
              {loading ? <LoadingSpinner label="Authenticating..." /> : "Sign In"}
            </button>

            <p className="text-[10px] text-center mt-2" style={{ color: "var(--text-very-muted)" }}>
              Approved users only.{" "}
              <button type="button" onClick={() => setTab("request")} className="underline transition-colors hover:text-emerald-400" style={{ color: "var(--text-very-muted)" }}>
                Request access
              </button>{" "}
              if you don't have an account.
            </p>
          </form>
        ) : (
          <form onSubmit={submitAccess} className="backdrop-blur-xl p-8 rounded-3xl shadow-2xl flex flex-col gap-4 animate-fade-in auth-card">
            {requestSubmitted ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-emerald-500/10 border border-emerald-400/25">
                  <svg className="w-8 h-8 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Request Submitted</h2>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                  Your access request has been sent to the system administrator.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRequestSubmitted(false);
                    setTab("login");
                  }}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-bold mb-1">Request System Access</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Fill in your details and an admin will review your request.</p>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-xs font-bold uppercase tracking-wider auth-label">Full Name <span className="text-red-400">*</span></label>
                  <input className={inputClass} type="text" placeholder="John Smith" value={requestForm.name} onChange={handleRequestChange("name")} required />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider auth-label">Email Address <span className="text-red-400">*</span></label>
                  <input className={inputClass} type="email" placeholder="you@company.com" value={requestForm.email} onChange={handleRequestChange("email")} required />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider auth-label">Organization</label>
                    <input className={inputClass} type="text" placeholder="Retail Co." value={requestForm.organization} onChange={handleRequestChange("organization")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider auth-label">Department</label>
                    <input className={inputClass} type="text" placeholder="Operations" value={requestForm.department} onChange={handleRequestChange("department")} />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider auth-label">Requested Access Level</label>
                  <select className={inputClass} value={requestForm.requested_role} onChange={handleRequestChange("requested_role")}>
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider auth-label">Reason for Access</label>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-all duration-200 resize-none auth-input"
                    placeholder="Briefly describe why you need access to BundleMind..."
                    value={requestForm.reason}
                    onChange={handleRequestChange("reason")}
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center"
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner label="Submitting Request..." /> : "Submit Access Request"}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
