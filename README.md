# AnonX 🔒💬

**AnonX** is a high-performance, real-time end-to-end encrypted (E2EE) anonymous messaging platform designed for privacy-first communication. It combines zero-latency WebSocket messaging with client-side cryptography, ensuring that messages are encrypted on the user's device before transmission and can only be decrypted by the intended recipient.

---

## ✨ Features

- 🔐 **End-to-End Encryption (E2EE)**: Built using `@noble/curves` (P-256 ECDH) and PBKDF2 key derivation. Messages are encrypted and decrypted client-side; raw message text never reaches the server in unencrypted form.
- 📱 **Multi-Device E2EE Sync**: Deterministic keypair derivation ensures seamless message decryption across multiple devices logged into the same account.
- ⚡ **Instant Authentication**: Fast, hassle-free username + password authentication with hashed passwords (`bcrypt`) and JWT session security.
- ⚡ **Zero-Latency Messaging**: Real-time bidirectional message delivery powered by Socket.IO.
- 🛡️ **User Controls & Privacy**: Native user blocking/unblocking with dynamic search and blocking logic.
- 🧹 **Automatic Daily Message Cleanup**: Ephemeral message model automatically purges messages prior to the current UTC day upon server startup and hourly background intervals.
- 🩺 **24/7 Uptime & Cold-Start Prevention**: Dedicated `/health` endpoint for continuous uptime monitoring (e.g., via UptimeRobot).
- 🚀 **Built-in Rate Limiting & Security**: Throttled auth and message endpoints powered by `express-rate-limit` with dynamic CORS configuration.

---

## 🛠️ Technical Stack

### **Frontend**
- **Framework**: React 19, Vite
- **Styling**: TailwindCSS v4
- **Routing**: React Router DOM v7
- **Cryptography**: `@noble/curves` (P-256 ECDH), Web Crypto API (AES-GCM / PBKDF2)
- **Real-Time**: `socket.io-client`

### **Backend**
- **Runtime**: Node.js, Express v5
- **Database**: MongoDB Atlas (via Mongoose)
- **Authentication**: JWT (`jsonwebtoken`), `bcrypt`
- **Real-Time**: Socket.IO
- **Rate Limiting**: `express-rate-limit`

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB database connection string (MongoDB Atlas or local)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/AnonX.git
   cd AnonX
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend/` folder:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```
   Start the backend development server:
   ```bash
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```
   Create a `.env` file in the `frontend/` folder (optional):
   ```env
   VITE_API_URL=http://localhost:5000
   ```
   Start the frontend development server:
   ```bash
   npm run dev
   ```

---

## 🌐 Complete API Endpoints

### 🩺 **Health & Keep-Alive**
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/health` | Uptime health check returning status `200 OK` | ❌ |

---

### 🔑 **Authentication (`/auth`)**
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/register` | Register new user account with unique username & password | ❌ |
| `POST` | `/auth/login` | Authenticate user & receive JWT token | ❌ |

---

### 👤 **Users & Keys (`/users`)**
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/users/public-key` | Upload/update user ECDH public key | ✅ |
| `GET` | `/users/public-key/:userCode` | Fetch target user's public key for E2EE encryption | ✅ |
| `POST` | `/users/search/:userCode` | Search user by username/user code | ✅ |
| `POST` | `/users/block` | Block target user | ✅ |
| `POST` | `/users/unblock` | Unblock target user | ✅ |
| `DELETE` | `/users/me` | Delete current user account & data | ✅ |

---

### 💬 **Conversations (`/conversations`)**
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/conversations/:userCode` | Fetch user conversations list | ✅ |
| `PATCH` | `/conversations/:conversationId/nickname` | Update custom conversation nickname | ✅ |

---

### 📩 **Messages (`/messages`)**
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/messages/send` | Send E2EE encrypted message to recipient | ✅ |
| `GET` | `/messages/:conversationId` | Fetch message history for a conversation | ✅ |
| `PATCH` | `/messages/read/:conversationId` | Mark messages in a conversation as read | ✅ |
