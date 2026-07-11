import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login as loginApi, register as registerApi } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import authBg from "../../assets/auth-bg.png";

const inputClass = "h-11 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400 focus:bg-slate-800 transition-all duration-200";

const AuthPage = () => {
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ fullName: "", email: "", password: "" });
  const { login } = useAuth();
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

  const submitRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await registerApi(registerForm.fullName, registerForm.email, registerForm.password);
      toast.success("Account request submitted. Waiting for Administrator approval.");
      setTab("login");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${authBg})` }}
    >
      {/* Semi-transparent dark overlay to ensure contrast while keeping the background clear */}
      <div className="absolute inset-0 bg-slate-950/45 pointer-events-none"></div>

      <div className="w-full max-w-[480px] z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.45)]">
            BundleMind
          </h1>
          <p className="mt-2 text-sm text-emerald-300 font-semibold tracking-wide drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
            supermarket predictive retail analytics portal
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="relative bg-slate-900 border border-slate-800 p-1 rounded-2xl flex mb-6 overflow-hidden">
          {/* Sliding active background indicator */}
          <div 
            className={`absolute top-1 bottom-1 w-[calc(50%-6px)] bg-slate-800 border border-slate-700/50 rounded-xl transition-all duration-300 ease-out ${
              tab === "login" ? "left-1.5" : "left-[calc(50%+4.5px)]"
            }`}
          />
          <button 
            type="button"
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-colors duration-300 z-10 ${
              tab === "login" ? "text-white" : "text-slate-400 hover:text-white"
            }`} 
            onClick={() => setTab("login")}
          >
            Login Access
          </button>
          <button 
            type="button"
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-colors duration-300 z-10 ${
              tab === "register" ? "text-white" : "text-slate-400 hover:text-white"
            }`} 
            onClick={() => setTab("register")}
          >
            Request Access
          </button>
        </div>

        {/* Login Tab */}
        {tab === "login" ? (
          <form onSubmit={submitLogin} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl shadow-2xl flex flex-col gap-4 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Welcome Back</h2>
              <p className="text-xs text-slate-400">Sign in to continue to BundleMind</p>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
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
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <input 
                className={inputClass} 
                type="password" 
                placeholder="••••••••••••" 
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
            
            <p className="text-[10px] text-center text-slate-500 mt-2">
              Approved users only. Contact system administrator for access inquiries.
            </p>
          </form>
        ) : (
          /* Register Tab */
          <form onSubmit={submitRegister} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl shadow-2xl flex flex-col gap-4 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Create Manager Profile</h2>
              <p className="text-xs text-slate-400">Submit access request for administrative approval</p>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
              <input 
                className={inputClass} 
                type="text"
                placeholder="John Doe" 
                value={registerForm.fullName} 
                onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} 
                required
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Work Email</label>
              <input 
                className={inputClass} 
                type="email"
                placeholder="john@gmail.com" 
                value={registerForm.email} 
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} 
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Create Password</label>
              <input 
                className={inputClass} 
                type="password" 
                placeholder="••••••••••••" 
                value={registerForm.password} 
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} 
                required
              />
            </div>

            <button 
              type="submit"
              className="mt-4 h-12 w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm transition-all flex items-center justify-center"
              disabled={loading}
            >
              {loading ? <LoadingSpinner label="Submitting Request..." /> : "Request Approval"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
