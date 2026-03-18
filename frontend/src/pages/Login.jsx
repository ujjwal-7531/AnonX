import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // New State
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
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
    <div className="h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-80">
        <h1 className="text-xl font-bold mb-4 text-center">Welcome Back</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full border p-2 rounded mb-3 focus:outline-none focus:ring-1 focus:ring-black"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full border p-2 rounded mb-3 focus:outline-none focus:ring-1 focus:ring-black"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full bg-black text-white p-2 rounded hover:bg-gray-800 transition-all font-medium"
        >
          Login
        </button>

        {message && <p className="mt-3 text-xs text-center text-red-500 font-semibold">{message}</p>}

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            New here?{" "}
            <Link to="/signup" className="text-black font-bold underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;