import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const validate = () => {
    let newErrors = {};
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = "Invalid email format";
    }
    if (!password) {
      newErrors.password = "Password is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    setMessage(""); // Clear previous overall messages
    if (!validate()) return;

    try {
      const res = await axios.post("http://localhost:5000/auth/login", { 
        email, 
        password 
      });

      if (res.data.userCode) {
        localStorage.setItem("userCode", res.data.userCode);
        setMessage("Success! Redirecting...");
        setTimeout(() => navigate("/chat"), 1000); // Send to chat
      }
    } catch (error) {
      // This helps if they try to login but account doesn't exist
      setMessage(error.response?.data?.message || "Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative bg-neutral-900/80 backdrop-blur-xl p-8 rounded-2xl border border-neutral-800/50 shadow-2xl w-full max-w-[360px] z-10 transition-all duration-300">
        <h1 className="text-2xl font-bold mb-6 text-center text-white tracking-tight">Welcome Back</h1>

        <div className="mb-4">
          <input
            type="email"
            placeholder="Email"
            className={`w-full bg-neutral-800/50 text-white border ${errors.email ? 'border-red-500/50 focus:border-red-500' : 'border-neutral-700/50 focus:border-indigo-500'} p-3 rounded-lg focus:outline-none focus:ring-1 ${errors.email ? 'focus:ring-red-500' : 'focus:ring-indigo-500'} transition-colors placeholder-neutral-500`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({...errors, email: null});
            }}
          />
          {errors.email && <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.email}</p>}
        </div>

        <div className="mb-6">
          <input
            type="password"
            placeholder="Password"
            className={`w-full bg-neutral-800/50 text-white border ${errors.password ? 'border-red-500/50 focus:border-red-500' : 'border-neutral-700/50 focus:border-indigo-500'} p-3 rounded-lg focus:outline-none focus:ring-1 ${errors.password ? 'focus:ring-red-500' : 'focus:ring-indigo-500'} transition-colors placeholder-neutral-500`}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors({...errors, password: null});
            }}
          />
          {errors.password && <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.password}</p>}
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 rounded-lg shadow-lg hover:shadow-indigo-500/25 hover:from-indigo-400 hover:to-purple-500 active:scale-[0.98] transition-all duration-200 font-medium"
        >
          Login
        </button>

        {message && (
          <p className={`mt-4 text-sm text-center font-medium ${message.includes("Success") ? "text-emerald-400" : "text-red-400"}`}>
            {message}
          </p>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-400">
            New here?{" "}
            <Link to="/signup" className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;