import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login as loginApi, register as registerApi } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/shared/LoadingSpinner";

const inputClass = "h-11 w-full rounded-lg border border-[#dbe3ec] px-4 text-sm outline-none focus:border-[#2563eb]";

const AuthPage = () => {
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "admin@bundlemind.com", password: "" });
  const [registerForm, setRegisterForm] = useState({ fullName: "", email: "", password: "" });
  const { login } = useAuth();
  const navigate = useNavigate();

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await loginApi(loginForm.email, loginForm.password);
      login(res.data.access_token);
      toast.success("Signed in successfully");
      navigate("/dashboard");
    } catch {
      toast.error("Invalid credentials or account not approved");
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await registerApi(registerForm.fullName, registerForm.email, registerForm.password);
      toast.success("Registration submitted. Wait for admin approval.");
      setTab("login");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-white pt-8">
      <div className="w-[820px]">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-[#0f172a]">BundleMind</h1>
          <p className="mt-2 text-lg font-semibold text-[#64748b]">Retail Manager / Admin Access</p>
        </div>
        <div className="mx-auto mt-8 flex h-12 w-[660px] rounded-full border border-[#dbe3ec] bg-[#f8fafc] p-2">
          <button className={`h-8 flex-1 rounded-full text-sm font-semibold ${tab === "login" ? "bg-[#2563eb] text-white" : "text-[#0369a1]"}`} onClick={() => setTab("login")}>
            Login
          </button>
          <button className={`h-8 flex-1 rounded-full text-sm font-semibold ${tab === "register" ? "bg-[#2563eb] text-white" : "bg-[#e0f2fe] text-[#0369a1]"}`} onClick={() => setTab("register")}>
            Register
          </button>
        </div>
        {tab === "login" ? (
          <form onSubmit={submitLogin} className="mx-auto mt-12 w-[440px] rounded-2xl border border-[#bfdbfe] bg-white p-10 shadow-sm">
            <h2 className="mb-6 text-2xl font-bold text-[#0f172a]">Login to System</h2>
            <label className="text-sm font-semibold text-[#64748b]">Email</label>
            <input className={`${inputClass} mt-1`} placeholder="admin@bundlemind.com" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
            <label className="mt-4 block text-sm font-semibold text-[#64748b]">Password</label>
            <input className={`${inputClass} mt-1`} type="password" placeholder="••••••••••" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
            <button className="mt-6 h-11 w-full rounded-lg bg-[#2563eb] font-semibold text-white" disabled={loading}>
              {loading ? <LoadingSpinner label="Signing in" /> : "Sign in"}
            </button>
            <p className="mt-4 text-center text-sm text-[#64748b]">Already approved users only</p>
          </form>
        ) : (
          <form onSubmit={submitRegister} className="mx-auto mt-12 w-[440px] rounded-2xl border border-[#bfdbfe] bg-white p-10 shadow-sm">
            <h2 className="mb-6 text-2xl font-bold text-[#0f172a]">Create Account</h2>
            <label className="text-sm font-semibold text-[#64748b]">Full name</label>
            <input className={`${inputClass} mt-1`} placeholder="Store Manager Name" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} />
            <label className="mt-3 block text-sm font-semibold text-[#64748b]">Work email</label>
            <input className={`${inputClass} mt-1`} placeholder="manager@store.com" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
            <label className="mt-3 block text-sm font-semibold text-[#64748b]">Create password</label>
            <input className={`${inputClass} mt-1`} type="password" placeholder="Minimum 8 characters" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
            <button className="mx-auto mt-5 block h-11 w-40 rounded-lg border border-[#dbe3ec] font-semibold text-[#2563eb]" disabled={loading}>
              {loading ? <LoadingSpinner label="Sending" /> : "Request Admin"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
