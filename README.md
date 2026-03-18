# 🕵️‍♂️ AnonX — Peer-to-Peer Anonymous Messenger

## ✨ Core Features

- **🔐 Zero-Identity Authentication**: Sign up using your email and a secure 6-digit OTP verification system.
- **🛡️ Total Anonymity**: No usernames or real names. Everyone is identified solely by a randomized 6-character **User Code**.
- **🎭 Dynamic Aliases**: Don't like a user's code? Set a custom local alias (nickname) for your contacts that only you can see.
- **⚡ Real-time Messaging**: Powered by **Socket.io** for instant, global message delivery with live "Unread" counters.
- **⏲️ Daily Quotas**: Anti-spam protection with a built-in **30 messages/day** limit per conversation, resetting automatically at UTC midnight.
- **🚫 Secure Blocking**: Instantly block or unblock users to maintain a safe chatting environment.
- **📱 Premium UI**: A sleek, dark-mode professional interface built with CSS-modules and **React-Hot-Toast** notifications.

---

## 🚀 Tech Stack

- **Frontend**: React.js, Vite, Axios, Lucide React (Icons), React Router.
- **Backend**: Node.js, Express.js.
- **Real-time**: Socket.io (with JWT handshake authentication).
- **Database**: MongoDB (Mongoose ODM).
- **Security**: JWT tokens, Bcrypt password hashing, Express Rate Limiter, CORS protection.
- **Email**: Nodemailer (Gmail SMTP integration).

---

## 🛠️ Local Setup Instructions

### 1. Prerequisites
- [Node.js](https://nodejs.org/) installed.
- [MongoDB](https://www.mongodb.com/) (Local or Atlas) installed.

### 2. Clone the Repository
```bash
git clone https://github.com/ujjwal-7531/AnonX.git
cd AnonX
```

### 3. Backend Configuration
Navigate to the `backend/` folder and create a `.env` file:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
CLIENT_URL=http://localhost:5173
```

### 4. Frontend Configuration
Navigate to the `frontend/` folder and create a `.env` file:
```env
VITE_API_URL=http://localhost:5000
```

### 5. Run the Application
In two separate terminals:

**Terminal 1 (Backend):**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev
```

---

## 🔒 Security Architecture

AnonX is built with a **Trust-No-One** philosophy:
- **Socket Isolation**: Users are isolated into private global namespaces based on their JWT identity.
- **Handshaking**: Sockets won't even connect if a valid JWT is missing from the browser's LocalStorage.
- **Proxy Handling**: Configured with `trust proxy` to prevent IP spoofing during rate-limiting.

---

## 📝 License
Distributed under the MIT License. See `LICENSE` for more information.

---

**Developed with ❤️ for Privacy.**
