import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "20kb" }));

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("Set JWT_SECRET to at least 32 characters in node-api/.env");
  process.exit(1);
}
const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");
let users, medicines, requests;

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const safeUser = u => ({ id: u._id.toString(), name: u.name, email: u.email, role: u.role });
function authenticate(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\\s+/i, "");
  try {
    if (!token) throw new Error("Missing token");
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Please log in again." });
  }
}
const allow = role => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).json({ message: "This action is not allowed for your account." });
  next();
};
const validDate = value => /^\\d{4}-\\d{2}-\\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(value));

app.get("/api/health", (req, res) => res.json({ message: "MediShare API is running" }));

app.post("/api/auth/signup", wrap(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name?.trim() || !/^\\S+@\\S+\\.\\S+$/.test(email || "") || (password || "").length < 8 ||
      !["donor", "receiver"].includes(role)) {
    return res.status(400).json({ message: "Enter a name, valid email, password (8+ characters), and donor/receiver role." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (await users.findOne({ email: normalizedEmail })) return res.status(409).json({ message: "Email already registered." });
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await users.insertOne({ name: name.trim(), email: normalizedEmail, password: passwordHash, role, createdAt: new Date() });
  const user = { _id: result.insertedId, name: name.trim(), email: normalizedEmail, role };
  const token = jwt.sign({ id: result.insertedId.toString(), role }, JWT_SECRET, { expiresIn: "2h" });
  res.status(201).json({ token, user: safeUser(user) });
}));

app.post("/api/auth/login", wrap(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = await users.findOne({ email });
  if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) {
    return res.status(400).json({ message: "Invalid email or password." });
  }
  const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: "2h" });
  res.json({ token, user: safeUser(user) });
}));

app.get("/api/medicines", authenticate, wrap(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const filter = { status: "available", expiryDate: { $gte: today } };
  const search = String(req.query.search || "").trim().slice(0, 80);
  if (search) filter.medicineName = { $regex: search.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"), $options: "i" };
  const rows = await medicines.find(filter, {
    projection: { medicineName: 1, quantity: 1, expiryDate: 1, notes: 1, donorName: 1, createdAt: 1 }
  }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json(rows.map(m => ({ ...m, id: m._id.toString(), safetyStatus: "Unverified – professional review required" })));
}));

app.post("/api/medicines", authenticate, allow("donor"), wrap(async (req, res) => {
  const { medicineName, quantity, expiryDate, notes = "" } = req.body;
  const qty = Number(quantity);
  const today = new Date().toISOString().slice(0, 10);
  if (!medicineName?.trim() || medicineName.trim().length > 100 || !Number.isInteger(qty) || qty < 1 || qty > 10000 ||
      !validDate(expiryDate) || expiryDate < today) {
    return res.status(400).json({ message: "Enter a medicine name, valid quantity and a future expiry date." });
  }
  const donor = await users.findOne({ _id: new ObjectId(req.user.id) }, { projection: { name: 1 } });
  const doc = {
    medicineName: medicineName.trim(), quantity: qty, expiryDate,
    notes: String(notes).trim().slice(0, 300), donorId: new ObjectId(req.user.id),
    donorName: donor?.name || "Registered donor", status: "available",
    createdAt: new Date(), safetyStatus: "unverified"
  };
  const result = await medicines.insertOne(doc);
  res.status(201).json({ message: "Listing added for information purposes.", id: result.insertedId.toString() });
}));

app.get("/api/medicines/mine", authenticate, allow("donor"), wrap(async (req, res) => {
  const rows = await medicines.find({ donorId: new ObjectId(req.user.id) }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json(rows.map(m => ({ ...m, id: m._id.toString() })));
}));

app.post("/api/medicine-requests", authenticate, allow("receiver"), wrap(async (req, res) => {
  if (!ObjectId.isValid(req.body.medicineId || "")) return res.status(400).json({ message: "Invalid medicine listing." });
  const medicine = await medicines.findOne({ _id: new ObjectId(req.body.medicineId), status: "available" });
  if (!medicine) return res.status(404).json({ message: "Listing is no longer available." });
  const existing = await requests.findOne({ medicineId: medicine._id, receiverId: new ObjectId(req.user.id), status: "submitted" });
  if (existing) return res.status(409).json({ message: "You have already submitted interest for this listing." });
  const result = await requests.insertOne({
    medicineId: medicine._id, medicineName: medicine.medicineName,
    receiverId: new ObjectId(req.user.id), donorId: medicine.donorId,
    status: "submitted", createdAt: new Date()
  });
  res.status(201).json({ message: "Interest recorded. This is not an approval to receive or use medicine.", id: result.insertedId.toString() });
}));

app.get("/api/medicine-requests/mine", authenticate, wrap(async (req, res) => {
  const field = req.user.role === "donor" ? "donorId" : "receiverId";
  const rows = await requests.find({ [field]: new ObjectId(req.user.id) }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json(rows.map(r => ({ ...r, id: r._id.toString() })));
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error. Check the backend terminal." });
});

async function start() {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "medishare");
  users = db.collection("users");
  medicines = db.collection("medicines");
  requests = db.collection("medicine_requests");
  await users.createIndex({ email: 1 }, { unique: true });
  await medicines.createIndex({ status: 1, expiryDate: 1 });
  await requests.createIndex({ medicineId: 1, receiverId: 1, status: 1 });
  app.listen(PORT, () => console.log(`MediShare API running at http://localhost:${PORT}`));
}
start().catch(error => { console.error("Startup failed:", error.message); process.exit(1); });
