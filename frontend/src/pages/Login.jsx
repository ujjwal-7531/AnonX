import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

function Login() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect straight to chat
    const userCode = localStorage.getItem("userCode");
    const token = localStorage.getItem("token");
    if (userCode && token) {
      navigate("/chat");
    }
  }, [navigate]);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const validateEmail = (val) => {
    return /^\S+@\S+\.\S+$/.test(val);
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Email address is required");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/auth/send-otp", { email: trimmedEmail });
      toast.success(res.data.message || "Code sent to your email");
      setStep(2);
      setCooldown(60);
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to send verification code";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setError("Please enter the 6-digit code");
      return;
    }

    if (trimmedOtp.length !== 6) {
      setError("Verification code must be 6 digits");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/auth/verify-otp", {
        email: email.trim().toLowerCase(),
        otp: trimmedOtp
      });

      if (res.data.userCode && res.data.token) {
        localStorage.setItem("userCode", res.data.userCode);
        localStorage.setItem("token", res.data.token);
        toast.success(res.data.message || "Authenticated successfully!");
        navigate("/chat");
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || "Invalid verification code";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4 relative overflow-hidden font-sans">
      {/* Ambient plain violet lighting glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative bg-neutral-900/80 backdrop-blur-2xl p-8 rounded-3xl border border-neutral-800/80 shadow-2xl w-full max-w-[380px] z-10 transition-all duration-300">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600 mb-3 shadow-lg shadow-violet-600/30 text-white font-bold text-xl">
            AX
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AnonX</h1>
          <p className="text-xs text-neutral-400 mt-1">Real-Time Anonymous Messaging</p>
        </div>

        {step === 1 ? (
          /* STEP 1: EMAIL INPUT */
          <form onSubmit={handleSendOTP}>
            <div className="mb-5">
              <label className="block text-xs font-medium text-neutral-300 mb-2">
                Enter your email address
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                autoFocus
                className={`w-full bg-neutral-800/60 text-white border ${
                  error ? "border-red-500/60 focus:border-red-500" : "border-neutral-700/60 focus:border-violet-500"
                } p-3.5 rounded-xl focus:outline-none focus:ring-1 ${
                  error ? "focus:ring-red-500" : "focus:ring-violet-500"
                } transition-all placeholder-neutral-500 text-sm`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
              />
              {error && <p className="text-red-400 text-xs mt-1.5 ml-1">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white py-3.5 rounded-xl shadow-lg shadow-violet-600/25 active:scale-[0.98] transition-all duration-200 font-semibold text-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Sending Code..." : "Continue"}
            </button>
          </form>
        ) : (
          /* STEP 2: OTP INPUT */
          <form onSubmit={handleVerifyOTP}>
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-neutral-300">
                  Enter 6-digit code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtp("");
                    setError("");
                  }}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Edit email
                </button>
              </div>

              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                autoFocus
                className={`w-full bg-neutral-800/60 text-white border ${
                  error ? "border-red-500/60 focus:border-red-500" : "border-neutral-700/60 focus:border-violet-500"
                } p-3.5 rounded-xl focus:outline-none focus:ring-1 ${
                  error ? "focus:ring-red-500" : "focus:ring-violet-500"
                } transition-all placeholder-neutral-600 text-center tracking-[0.4em] font-mono text-lg`}
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setOtp(val);
                  if (error) setError("");
                }}
              />
              <p className="text-[11px] text-neutral-500 mt-2 text-center">
                Code sent to <span className="text-neutral-300 font-medium">{email}</span>
              </p>
              {error && <p className="text-red-400 text-xs mt-1 text-center">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white py-3.5 rounded-xl shadow-lg shadow-violet-600/25 active:scale-[0.98] transition-all duration-200 font-semibold text-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Verifying..." : "Verify & Enter Chat"}
            </button>

            <div className="mt-4 text-center">
              {cooldown > 0 ? (
                <p className="text-xs text-neutral-500">
                  Resend code in <span className="text-neutral-400 font-medium">{cooldown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={loading}
                  className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                >
                  Resend verification code
                </button>
              )}
            </div>
          </form>
        )}

        <div className="mt-8 pt-4 border-t border-neutral-800/60 text-center">
          <p className="text-[11px] text-neutral-500">
            🔒 Passwordless & Anonymous. Your identity is protected by user codes.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;