# MediShare – Online Unused Medicine Donation for NGOs

A full-stack academic prototype that organizes medicine donation listings and helps donors and receivers/NGOs discover information in one place.

## Stack
- React + Vite
- Node.js + Express
- MongoDB
- bcryptjs password hashing
- JWT authentication and donor/receiver role checks

## Important safety notice
MediShare is an information-management academic prototype. It does **not** verify medicine authenticity, storage, packaging, quality, prescription status, or legal eligibility. Do not use this application to arrange real medicine redistribution without review and authorization from qualified healthcare professionals and compliance with applicable laws and regulations. Never consume medicine based only on a listing in this app. The demo intentionally labels listings as unverified.

## Requirements
- Node.js 18+
- MongoDB local instance or MongoDB Atlas connection string

## Run the backend
```bash
cd node-api
copy .env.example .env
```
Edit `.env` and set `MONGODB_URI` and a long random `JWT_SECRET`.
```bash
npm install
npm run dev
```
Backend: `http://localhost:3001`

## Run the frontend
In a second terminal:
```bash
cd react-frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

## Main API routes
| Method | Route | Access |
|---|---|---|
| GET | `/api/health` | Public |
| POST | `/api/auth/signup` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/medicines` | Logged-in users |
| POST | `/api/medicines` | Donor |
| GET | `/api/medicines/mine` | Donor |
| POST | `/api/medicine-requests` | Receiver |
| GET | `/api/medicine-requests/mine` | Logged-in user |

## GitHub
Do not commit `.env`, MongoDB credentials, JWT secrets, real personal information, or `node_modules`.
