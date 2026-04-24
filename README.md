# AnonX

AnonX is a real-time anonymous messaging platform built with React, Express, Socket.io, and MongoDB.  
Users sign up using email OTP verification and communicate through generated user codes instead of personal identities.

## Features

- Email OTP-based signup and verification
- Login with JWT authentication
- Real-time one-to-one messaging via Socket.io
- Anonymous identities using generated user codes and aliases
- Daily message quota per conversation (resets at UTC midnight)
- Unread message tracking
- Block and unblock controls

## Tech Stack

- Frontend: React, Vite, Axios, React Router
- Backend: Node.js, Express
- Realtime: Socket.io
- Database: MongoDB (Mongoose)
- Auth/Security: JWT, bcrypt, CORS, rate limiting
- Email: Nodemailer (Gmail SMTP)

## Repository Structure

```text
AnonX/
  backend/    # Express API + Socket.io + MongoDB models
  frontend/   # React + Vite client
```

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_secret
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
CLIENT_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
```

## Local Development

### 1) Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2) Start backend

```bash
cd backend
npm run dev
```

### 3) Start frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173` by default and connects to `VITE_API_URL`.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
