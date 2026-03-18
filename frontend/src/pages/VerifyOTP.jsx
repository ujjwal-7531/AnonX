import { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

function VerifyOTP() {
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isError, setIsError] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email;
  const password = location.state?.password; 

  if (!email || !password) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-white">
        <p className="mb-4 text-neutral-400">No data found. Please try again.</p>
        <button
          onClick={() => navigate("/signup")}
          className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium border-b border-transparent hover:border-indigo-400"
        >
          Go back to Signup
        </button>
      </div>
    );
  }

  const handleVerify = async () => {
    setMessage("");
    setIsError(false);

    if (!otp) {
        setIsError(true);
        setMessage("Please enter the 6-digit OTP");
        return;
    }

    if (otp.length < 6) {
        setIsError(true);
        setMessage("OTP must be 6 digits");
        return;
    }

    try {
        const res = await axios.post(
          "http://localhost:5000/auth/verify-otp",
          { email, otp }
        );

        localStorage.setItem("userCode", res.data.userCode);
        localStorage.setItem("token", res.data.token);
        setMessage("Identity Verified! Entering...");
        setIsError(false);
        setTimeout(() => navigate("/chat"), 1500); 

    } catch (error) {
        setIsError(true);
        setMessage(error.response?.data?.message || "Invalid OTP");
    }
  };

  useEffect(() => {
    if (canResend) return;
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [canResend]);

  const handleResendOTP = async () => {
    setCanResend(false);
    setTimer(60);
    setMessage("Sending new OTP...");
    setIsError(false);

    try {
        await axios.post("http://localhost:5000/auth/register", {
          email,
          password
        });
        setMessage("OTP resent successfully!");
    } catch (error) {
        setIsError(true);
        setMessage(error.response?.data?.message || "Error resending OTP");
        setCanResend(true);
        setTimer(0);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative bg-neutral-900/80 backdrop-blur-xl p-8 rounded-2xl border border-neutral-800/50 shadow-2xl w-full max-w-[360px] z-10 transition-all duration-300">

        <h1 className="text-2xl font-bold mb-2 text-center text-white tracking-tight">
          Verify Email
        </h1>

        <p className="text-sm mb-6 text-center text-neutral-400">
          Code sent to: <span className="text-neutral-200">{email}</span>
        </p>

        <div className="mb-6">
          <input
            type="text"
            placeholder="000000"
            maxLength={6}
            className={`w-full bg-neutral-800/50 text-white border ${isError ? 'border-red-500/50 focus:border-red-500' : 'border-neutral-700/50 focus:border-indigo-500'} p-4 rounded-lg text-center tracking-[0.5em] text-2xl font-mono focus:outline-none focus:ring-1 ${isError ? 'focus:ring-red-500' : 'focus:ring-indigo-500'} transition-colors placeholder-neutral-600`}
            value={otp}
            onChange={(e) => {
              // Only allow numbers
              const val = e.target.value.replace(/[^0-9]/g, '');
              setOtp(val);
              if (isError) {
                setIsError(false);
                setMessage("");
              }
            }}
          />
        </div>

        <button
          onClick={handleVerify}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 rounded-lg shadow-lg hover:shadow-indigo-500/25 hover:from-indigo-400 hover:to-purple-500 active:scale-[0.98] transition-all duration-200 font-medium mb-4"
        >
          Verify & Enter
        </button>

        {message && (
          <p className={`text-sm text-center font-medium mb-3 ${isError ? "text-red-400" : "text-emerald-400"}`}>
            {message}
          </p>
        )}

        <div className="text-center text-sm">
          {!canResend ? (
            <p className="text-neutral-500">
              Resend OTP in{" "}
              <span className="text-neutral-300 font-mono">
                {String(Math.floor(timer / 60)).padStart(2, "0")}:
                {String(timer % 60).padStart(2, "0")}
              </span>
            </p>
          ) : (
            <button
              onClick={handleResendOTP}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors border-b border-transparent hover:border-indigo-400"
            >
              Resend OTP
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default VerifyOTP;