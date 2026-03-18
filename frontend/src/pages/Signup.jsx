import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // New State
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSendOTP = async () => {
    try {
      // Sending both email and password to the backend
      const res = await axios.post("http://localhost:5000/auth/register", {
        email,
        password 
      });

      setMessage(res.data.message);
      // Pass both to the verify page if needed, or just email
      navigate("/verify", { state: { email } });
    } catch (error) {
      setMessage(error.response?.data?.message || "Error occurred");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-80 text-black">
        <h1 className="text-xl font-bold mb-4 text-center italic text-black">AnonX Signup</h1>
        
        <input
          type="email"
          placeholder="Email address"
          className="w-full border p-2 rounded mb-3 focus:outline-none focus:ring-1 focus:ring-black"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Create Password"
          className="w-full border p-2 rounded mb-3 focus:outline-none focus:ring-1 focus:ring-black"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleSendOTP}
          className="w-full bg-black text-white p-2 rounded hover:bg-gray-800 transition-colors font-medium"
        >
          Create Account
        </button>

        {message && <p className="mt-3 text-xs text-center text-red-500">{message}</p>}

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            Already a member?{" "}
            <Link to="/login" className="text-black font-bold underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;