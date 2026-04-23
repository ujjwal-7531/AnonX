import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!validate()) return;
    
      setIsLoading(true);

    try {
      await axios.post("/auth/register", {
        email,
        password
      });

      setMessage("OTP sent! Redirecting to verification...");
      setTimeout(() => {
        navigate("/verify-otp", { state: { email } });
      }, 1500);

    } catch (error) {
      setMessage(error.response?.data?.message || "Error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative bg-neutral-900/80 backdrop-blur-xl p-8 rounded-2xl border border-neutral-800/50 shadow-2xl w-full max-w-[360px] z-10 transition-all duration-300">
        <h1 className="text-2xl font-bold mb-6 text-center text-white tracking-tight">Create Account</h1>
        
        <form onSubmit={handleSendOTP}>
        <div className="mb-4">
          <input
            type="email"
            placeholder="Email address"
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
            placeholder="Create Password"
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
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 rounded-lg shadow-lg hover:shadow-indigo-500/25 hover:from-indigo-400 hover:to-purple-500 active:scale-[0.98] transition-all duration-200 font-medium disabled:opacity-50"
        >
          {isLoading ? "Sending OTP..." : "Sign Up"}
        </button>
        </form>

        {message && (
          <p className={`mt-4 text-sm text-center font-medium ${message.includes("Redirecting") ? "text-emerald-400" : "text-red-400"}`}>
            {message}
          </p>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-400">
            Already a member?{" "}
            <Link to="/login" className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;