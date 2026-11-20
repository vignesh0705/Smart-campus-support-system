import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Complaint } from "./models.js";

const users = [
  { name: "Alex Morgan", email: "student@campus.edu", password: "Campus123!", role: "student" },
  { name: "Jordan Lee", email: "admin@campus.edu", password: "Campus123!", role: "admin" },
  { name: "Taylor Reed", email: "staff@campus.edu", password: "Campus123!", role: "staff", department: "Facilities" },
  { name: "Sam Patel", email: "staff2@campus.edu", password: "Campus123!", role: "staff", department: "Electrical" }
];

try {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-campus");
  const records = {};
  for (const item of users) {
    const { password, ...details } = item;
    records[item.role === "staff" ? `${item.role}:${item.email}` : item.role] = await User.findOneAndUpdate(
      { email: item.email },
      { ...details, passwordHash: await bcrypt.hash(password, 12) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  if (!(await Complaint.exists({}))) {
    const examples = [
      {
        title: "Water leak near the library",
        description: "There is a steady leak from the ceiling outside the second floor study rooms. The floor is getting slippery.",
        location: "North Library · Floor 2",
        category: "Plumbing",
        priority: "high",
        status: "in-progress",
        assignedTo: records["staff:staff@campus.edu"],
        history: [{ status: "submitted", note: "Complaint submitted for review.", actorName: records.student.name, createdAt: new Date(Date.now() - 86400000) }, { status: "in-progress", note: "Maintenance team is investigating.", actorName: records["staff:staff@campus.edu"].name, createdAt: new Date(Date.now() - 3600000) }]
      },
      {
        title: "Projector not connecting in room 204",
        description: "The lecture hall projector shows no signal even after trying another HDMI cable. Class starts at 2pm.",
        location: "Engineering Hall · Room 204",
        category: "Network & IT",
        priority: "medium",
        status: "submitted",
        history: [{ status: "submitted", note: "Complaint submitted for review.", actorName: records.student.name, createdAt: new Date(Date.now() - 7200000) }]
      },
      {
        title: "Flickering lights in the west stairwell",
        description: "Two lights are flickering on the west stairwell between floors one and two, making it hard to see.",
        location: "West Residence · Stairwell B",
        category: "Electrical",
        priority: "urgent",
        status: "resolved",
        assignedTo: records["staff:staff2@campus.edu"],
        history: [{ status: "submitted", note: "Complaint submitted for review.", actorName: records.student.name, createdAt: new Date(Date.now() - 172800000) }, { status: "resolved", note: "Lighting fixture replaced and tested.", actorName: records["staff:staff2@campus.edu"].name, createdAt: new Date(Date.now() - 43200000) }]
      }
    ];
    await Complaint.insertMany(examples.map((example) => ({ ...example, student: records.student, aiSummary: `Suggested ${example.category.toLowerCase()} support based on the reported issue.` })));
  }
  console.log("Demo accounts ready. All accounts use password: Campus123!");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
