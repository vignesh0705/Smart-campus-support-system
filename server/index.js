import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Complaint, User } from "./models.js";
import { classifyComplaint } from "./triage.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 24) {
  throw new Error("JWT_SECRET must be configured with at least 24 characters.");
}

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "20kb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }));

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, department: user.department };
}

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString() }, jwtSecret, { expiresIn: "8h" });
}

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Sign in to continue." });
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ message: "Your session is no longer valid." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Your session is invalid or has expired." });
  }
}

function allowRoles(...roles) {
  return (req, res, next) =>
    roles.includes(req.user.role) ? next() : res.status(403).json({ message: "You don't have permission to do that." });
}

function complaintView(item) {
  return {
    id: item._id.toString(),
    title: item.title,
    description: item.description,
    location: item.location,
    category: item.category,
    priority: item.priority,
    status: item.status,
    student: item.student ? publicUser(item.student) : null,
    assignedTo: item.assignedTo ? publicUser(item.assignedTo) : null,
    aiSummary: item.aiSummary,
    history: item.history,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", database: mongoose.connection.readyState === 1 }));

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return res.status(400).json({ message: "Enter a valid name and email, and a password of at least 8 characters." });
    }
    if (await User.exists({ email })) return res.status(409).json({ message: "An account with that email already exists." });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: "student" });
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

app.get("/api/staff", authenticate, allowRoles("admin"), async (_req, res, next) => {
  try {
    const staff = await User.find({ role: "staff" }).sort({ name: 1 });
    res.json(staff.map(publicUser));
  } catch (error) {
    next(error);
  }
});

app.get("/api/complaints", authenticate, async (req, res, next) => {
  try {
    const filter = req.user.role === "student"
      ? { student: req.user._id }
      : req.user.role === "staff"
        ? { assignedTo: req.user._id }
        : {};
    const items = await Complaint.find(filter)
      .populate("student")
      .populate("assignedTo")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(items.map(complaintView));
  } catch (error) {
    next(error);
  }
});

app.post("/api/complaints", authenticate, allowRoles("student"), async (req, res, next) => {
  try {
    const title = String(req.body.title ?? "").trim();
    const description = String(req.body.description ?? "").trim();
    const location = String(req.body.location ?? "").trim();
    if (title.length < 5 || title.length > 120 || description.length < 15 || description.length > 3000 || !location || location.length > 120) {
      return res.status(400).json({ message: "Add a clear title, at least 15 characters of detail, and a location." });
    }
    const triage = await classifyComplaint(`${title}. ${description}`);
    const complaint = await Complaint.create({
      title,
      description,
      location,
      category: triage.category,
      priority: triage.priority,
      aiSummary: triage.summary,
      student: req.user._id,
      history: [{ status: "submitted", note: "Complaint submitted for review.", actorName: req.user.name }]
    });
    await complaint.populate("student");
    res.status(201).json(complaintView(complaint));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/complaints/:id", authenticate, allowRoles("admin", "staff"), async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });
    if (req.user.role === "staff" && complaint.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Staff can only update complaints assigned to them." });
    }

    const changes = [];
    if (req.body.status !== undefined) {
      const allowed = ["submitted", "in-progress", "resolved", "rejected"];
      if (!allowed.includes(req.body.status)) return res.status(400).json({ message: "Choose a valid complaint status." });
      if (complaint.status !== req.body.status) {
        complaint.status = req.body.status;
        changes.push(`Status updated to ${req.body.status.replace("-", " ")}.`);
      }
    }
    if (req.body.assignedTo !== undefined) {
      if (req.user.role !== "admin") return res.status(403).json({ message: "Only admins can assign staff." });
      const staff = req.body.assignedTo ? await User.findOne({ _id: req.body.assignedTo, role: "staff" }) : null;
      if (req.body.assignedTo && !staff) return res.status(400).json({ message: "Select a valid staff member." });
      const previousId = complaint.assignedTo?.toString() ?? "";
      const nextId = staff?._id.toString() ?? "";
      complaint.assignedTo = staff?._id ?? null;
      if (previousId !== nextId) changes.push(staff ? `Assigned to ${staff.name}.` : "Staff assignment removed.");
    }
    if (req.body.priority !== undefined && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can change complaint priority." });
    }
    if (req.body.priority !== undefined) {
      if (!["low", "medium", "high", "urgent"].includes(req.body.priority)) {
        return res.status(400).json({ message: "Choose a valid priority." });
      }
      if (complaint.priority !== req.body.priority) {
        complaint.priority = req.body.priority;
        changes.push(`Priority changed to ${req.body.priority}.`);
      }
    }
    for (const note of changes) complaint.history.push({ status: complaint.status, note, actorName: req.user.name });
    await complaint.save();
    await complaint.populate(["student", "assignedTo"]);
    res.json(complaintView(complaint));
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === 11000) return res.status(409).json({ message: "An account with that email already exists." });
  if (error.name === "CastError") return res.status(400).json({ message: "The requested record ID is invalid." });
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-campus")
  .then(() => app.listen(port, () => console.log(`Campus API listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  });
