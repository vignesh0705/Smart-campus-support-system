import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "staff", "admin"], default: "student" },
    department: { type: String, default: "" }
  },
  { timestamps: true }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    actorName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], required: true },
    status: {
      type: String,
      enum: ["submitted", "in-progress", "resolved", "rejected"],
      default: "submitted"
    },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    aiSummary: { type: String, default: "" },
    history: { type: [historySchema], default: [] }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
export const Complaint = mongoose.model("Complaint", complaintSchema);
