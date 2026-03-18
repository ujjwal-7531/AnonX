import { useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

function VerifyOTP() {
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  // Protect the route: if no email in state, go back to signup
  if (!email) {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <p>No email found. Please try again.</p>
        <button onClick={() => navigate("/signup")} className="text-blue-500 underline">Go back</button>
      </div>
    );
  }

  const handleVerify = async () => {
    try {
      const res = await axios.post("http://localhost:5000/auth/verify-otp", { email, otp });
      localStorage.setItem("userCode", res.data.userCode);
      setMessage("Success! Redirecting...");
      
      // Redirect to Chat or Dashboard after a delay
      setTimeout(() => navigate("/chat"), 1500);
    } catch (error) {
      setMessage(error.response?.data?.message || "Invalid OTP");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-xl shadow-md w-80">
        <h1 className="text-xl font-bold mb-2 text-center">Confirm Identity</h1>
        <p className="text-xs mb-4 text-center text-gray-500 italic">Code sent to: {email}</p>

        <input
          type="text"
          placeholder="000000"
          maxLength={6}
          className="w-full border p-2 rounded mb-3 text-center tracking-widest text-lg font-mono"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <button
          onClick={handleVerify}
          className="w-full bg-black text-white p-2 rounded"
        >
          Verify & Enter
        </button>

        {message && (
          <p className={`mt-3 text-sm text-center ${message.includes('Success') ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default VerifyOTP;