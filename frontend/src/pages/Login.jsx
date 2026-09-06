import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Specific field error states
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect straight to chat
    const userCode = localStorage.getItem("userCode");
    const token = localStorage.getItem("token");
    if (userCode && token) {
      navigate("/chat");
    }
  }, [navigate]);

  const clearErrors = () => {
    setUsernameError("");
    setPasswordError("");
    setGeneralError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearErrors();

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();
    let hasValidationError = false;

    if (!trimmedUsername) {
      setUsernameError("Username is required");
      hasValidationError = true;
    } else if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      setUsernameError("Username must be between 3 and 30 characters");
      hasValidationError = true;
    } else if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setUsernameError("Only letters, numbers, and underscores allowed");
      hasValidationError = true;
    }

    if (!trimmedPassword) {
      setPasswordError("Password is required");
      hasValidationError = true;
    } else if (trimmedPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long");
      hasValidationError = true;
    }

    if (hasValidationError) return;

    setLoading(true);
    const endpoint = isSignUp ? "/auth/register" : "/auth/login";

    try {
      const res = await axios.post(endpoint, {
        username: trimmedUsername,
        password: trimmedPassword
      });

      if (res.data.userCode && res.data.token) {
        localStorage.setItem("userCode", res.data.userCode);
        localStorage.setItem("token", res.data.token);
        if (res.data.username) {
          localStorage.setItem("username", res.data.username);
        }
        toast.success(res.data.message || (isSignUp ? "Account created!" : "Logged in successfully!"));
        navigate("/chat");
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || `Failed to ${isSignUp ? "create account" : "log in"}`;
      
      if (errMsg.toLowerCase().includes("username")) {
        setUsernameError(errMsg);
      } else if (errMsg.toLowerCase().includes("password")) {
        setPasswordError(errMsg);
      } else {
        setGeneralError(errMsg);
      }
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
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600 mb-3 shadow-lg shadow-violet-600/30 text-white font-bold text-xl">
            AX
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AnonX</h1>
          <p className="text-xs text-neutral-400 mt-1">Real-Time Anonymous Messaging</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-neutral-800/60 p-1 rounded-xl mb-6 border border-neutral-700/50">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              clearErrors();
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              !isSignUp
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              clearErrors();
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              isSignUp
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-medium text-neutral-300 mb-1.5 ml-1">
              Username
            </label>
            <input
              type="text"
              placeholder="e.g. shadow_user"
              autoFocus
              className={`w-full bg-neutral-800/60 text-white border ${
                usernameError ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" : "border-neutral-700/60 focus:border-violet-500 focus:ring-violet-500"
              } p-3 rounded-xl focus:outline-none focus:ring-1 transition-all placeholder-neutral-500 text-sm`}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError("");
                if (generalError) setGeneralError("");
              }}
            />
            {usernameError && <p className="text-red-400 text-xs mt-1.5 ml-1">{usernameError}</p>}
          </div>

          <div className="mb-5">
            <label className="block text-xs font-medium text-neutral-300 mb-1.5 ml-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className={`w-full bg-neutral-800/60 text-white border ${
                passwordError ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" : "border-neutral-700/60 focus:border-violet-500 focus:ring-violet-500"
              } p-3 rounded-xl focus:outline-none focus:ring-1 transition-all placeholder-neutral-500 text-sm`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError("");
                if (generalError) setGeneralError("");
              }}
            />
            {passwordError && <p className="text-red-400 text-xs mt-1.5 ml-1">{passwordError}</p>}
          </div>

          {generalError && (
            <div className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
              <p className="text-red-400 text-xs">{generalError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white py-3.5 rounded-xl shadow-lg shadow-violet-600/25 active:scale-[0.98] transition-all duration-200 font-semibold text-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading
              ? isSignUp ? "Creating Account..." : "Logging In..."
              : isSignUp ? "Sign Up & Enter Chat" : "Log In & Enter Chat"}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-neutral-800/60 text-center">
          <p className="text-[11px] text-neutral-500">
            🔒 Anonymous & Encrypted. Your identity is protected by user codes.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;