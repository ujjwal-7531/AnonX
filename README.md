# AnonX

## Description
AnonX is a high-performance, real-time anonymous messaging platform designed to facilitate secure communication without compromising personal identity. Instead of exposing standard usernames or profiles, the application dynamically generates unique user codes to route localized conversations. Built using a robust React frontend and a Socket.io-driven Express backend, AnonX ensures zero-latency instantaneous messaging while enforcing strict usage limits and identity protection across the network.

## Technical Stack
- Frontend: React, Vite, React Router
- Backend: Node.js, Express
- Real-Time Communication: Socket.io
- Database: MongoDB (Mongoose Schema Architecture)
- Authentication: JWT, bcrypt, CORS, Advanced Rate-Limiting
- Email: Nodemailer (SMTP Integration)

## Core Functionalities

### Authentication and Identity Security
- Secure registration and login workflows utilizing cryptographic password hashing (bcrypt) and JWT allocations.
- Stringent identity processing utilizing mandated Email OTP verification prior to granting platform access.
- Native identity obfuscation generating randomized, non-traceable user codes for all platform interactions.
- Alias generation allowing users to mask their identifiers dynamically without changing database roots.

### Real-Time Communication
- Zero-latency, bidirectional one-to-one messaging powered by persistent Socket.io connections.
- Native unread message tracking computing delivery states across active sockets in real-time.

### Privacy and Traffic Management
- Advanced network throttling imposing strict daily message quotas per conversation (automatically resetting at UTC midnight) to prevent spam abuse.
- Complete user sovereignty through implemented Block and Unblock infrastructural controls, instantly severing unwanted socket connections and preventing targeted harassment.
