const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const STORE = "campuscare-demo-data";
const demoUsers = [
  { id: "demo-student", name: "Alex Morgan", email: "student@campus.edu", password: "Campus123!", role: "student" },
  { id: "demo-admin", name: "Jordan Lee", email: "admin@campus.edu", password: "Campus123!", role: "admin" },
  { id: "demo-staff", name: "Taylor Reed", email: "staff@campus.edu", password: "Campus123!", role: "staff", department: "Facilities" },
  { id: "demo-staff-2", name: "Sam Patel", email: "staff2@campus.edu", password: "Campus123!", role: "staff", department: "Electrical" }
];

const initialItems = [
  {
    id: "CC-1048", title: "Water leak near the library", description: "There is a steady leak from the ceiling outside the second floor study rooms. The floor is getting slippery.",
    location: "North Library · Floor 2", category: "Plumbing", priority: "high", status: "in-progress",
    student: { id: "demo-student", name: "Alex Morgan", email: "student@campus.edu", role: "student" },
    assignedTo: { id: "demo-staff", name: "Taylor Reed", role: "staff" },
    aiSummary: "Suggested plumbing support based on the reported issue.",
    history: [{ status: "submitted", note: "Complaint submitted for review.", actorName: "Alex Morgan", createdAt: new Date(Date.now() - 86400000).toISOString() }, { status: "in-progress", note: "Maintenance team is investigating.", actorName: "Taylor Reed", createdAt: new Date(Date.now() - 3600000).toISOString() }],
    createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: "CC-1047", title: "Projector not connecting in room 204", description: "The lecture hall projector shows no signal even after trying another HDMI cable. Class starts at 2pm.",
    location: "Engineering Hall · Room 204", category: "Network & IT", priority: "medium", status: "submitted",
    student: { id: "demo-student", name: "Alex Morgan", email: "student@campus.edu", role: "student" }, assignedTo: null,
    aiSummary: "Suggested network & IT support based on the reported issue.",
    history: [{ status: "submitted", note: "Complaint submitted for review.", actorName: "Alex Morgan", createdAt: new Date(Date.now() - 7200000).toISOString() }],
    createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: "CC-1046", title: "Flickering lights in the west stairwell", description: "Two lights are flickering on the west stairwell between floors one and two, making it hard to see.",
    location: "West Residence · Stairwell B", category: "Electrical", priority: "urgent", status: "resolved",
    student: { id: "demo-student", name: "Alex Morgan", email: "student@campus.edu", role: "student" },
    assignedTo: { id: "demo-staff-2", name: "Sam Patel", role: "staff" },
    aiSummary: "Suggested electrical support based on the reported issue.",
    history: [{ status: "submitted", note: "Complaint submitted for review.", actorName: "Alex Morgan", createdAt: new Date(Date.now() - 172800000).toISOString() }, { status: "resolved", note: "Lighting fixture replaced and tested.", actorName: "Sam Patel", createdAt: new Date(Date.now() - 43200000).toISOString() }],
    createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 43200000).toISOString()
  }
];

let useDemo = false;

function readStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE));
    if (stored?.complaints && stored?.users) return stored;
  } catch {
    localStorage.removeItem(STORE);
  }
  const data = { users: demoUsers, complaints: initialItems };
  localStorage.setItem(STORE, JSON.stringify(data));
  return data;
}

function writeStore(data) {
  localStorage.setItem(STORE, JSON.stringify(data));
}

export async function connectApi() {
  try {
    const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(1400) });
    const health = await response.json();
    useDemo = !response.ok || !health.database;
  } catch {
    useDemo = true;
  }
  return !useDemo;
}

async function request(path, options = {}) {
  const token = localStorage.getItem("campuscare-token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed. Please try again.");
  return data;
}

function classify(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const categories = [
    ["Electrical", ["electric", "power", "light", "outlet", "wiring", "socket", "blackout"]],
    ["Plumbing", ["water", "leak", "pipe", "faucet", "toilet", "drain", "flood"]],
    ["Facilities", ["broken", "door", "window", "furniture", "ceiling", "classroom", "building"]],
    ["Cleaning", ["trash", "dirty", "clean", "garbage", "pest", "spill", "sanitation"]],
    ["Network & IT", ["wifi", "internet", "network", "computer", "projector", "printer", "login"]],
    ["Safety", ["unsafe", "hazard", "fire", "smoke", "injury", "security", "emergency"]]
  ];
  const matches = categories.map(([category, words]) => ({ category, score: words.filter((word) => text.includes(word)).length })).sort((a, b) => b.score - a.score);
  const category = matches[0].score ? matches[0].category : "General";
  const priority = ["fire", "smoke", "flood", "exposed wire", "emergency", "injury", "unsafe"].some((word) => text.includes(word))
    ? "urgent"
    : ["broken", "leak", "outage", "not working", "no water", "no power"].some((word) => text.includes(word))
      ? "high"
      : matches[0].score ? "medium" : "low";
  return { category, priority, summary: `Suggested ${category.toLowerCase()} support based on the reported issue.` };
}

export const api = {
  async login(email, password) {
    if (!useDemo) return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    const user = readStore().users.find((item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password);
    if (!user) throw new Error("Email or password is incorrect. Try one of the demo accounts.");
    const { password: _password, ...safeUser } = user;
    return { token: `demo.${user.id}`, user: safeUser };
  },
  async register(name, email, password) {
    if (!useDemo) return request("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    const data = readStore();
    if (data.users.some((item) => item.email.toLowerCase() === email.toLowerCase())) throw new Error("An account with that email already exists.");
    const user = { id: `student-${Date.now()}`, name, email, password, role: "student" };
    data.users.push(user);
    writeStore(data);
    const { password: _password, ...safeUser } = user;
    return { token: `demo.${user.id}`, user: safeUser };
  },
  async getComplaints() {
    if (!useDemo) return request("/complaints");
    const user = JSON.parse(localStorage.getItem("campuscare-user") || "null");
    const items = readStore().complaints;
    if (user?.role === "student") return items.filter((item) => item.student?.id === user.id);
    if (user?.role === "staff") return items.filter((item) => item.assignedTo?.id === user.id);
    return items;
  },
  async getStaff() {
    if (!useDemo) return request("/staff");
    return readStore().users.filter((user) => user.role === "staff").map(({ password: _password, ...user }) => user);
  },
  async createComplaint(payload) {
    if (!useDemo) return request("/complaints", { method: "POST", body: JSON.stringify(payload) });
    const data = readStore();
    const user = JSON.parse(localStorage.getItem("campuscare-user") || "null");
    const triage = classify(payload.title, payload.description);
    const item = {
      ...payload, ...triage, id: `CC-${Date.now().toString().slice(-5)}`, status: "submitted",
      student: user, assignedTo: null,
      history: [{ status: "submitted", note: "Complaint submitted for review.", actorName: user.name, createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    data.complaints.unshift(item);
    writeStore(data);
    return item;
  },
  async updateComplaint(id, updates) {
    if (!useDemo) return request(`/complaints/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
    const data = readStore();
    const item = data.complaints.find((complaint) => complaint.id === id);
    if (!item) throw new Error("Complaint not found.");
    const user = JSON.parse(localStorage.getItem("campuscare-user") || "null");
    if (updates.status && updates.status !== item.status) {
      item.status = updates.status;
      item.history.push({ status: updates.status, note: `Status updated to ${updates.status.replace("-", " ")}.`, actorName: user.name, createdAt: new Date().toISOString() });
    }
    if (updates.assignedTo !== undefined) {
      const staff = data.users.find((person) => person.id === updates.assignedTo);
      const nextAssignment = staff ? { id: staff.id, name: staff.name, role: staff.role } : null;
      if ((item.assignedTo?.id || "") !== (nextAssignment?.id || "")) {
        item.assignedTo = nextAssignment;
        item.history.push({ status: item.status, note: staff ? `Assigned to ${staff.name}.` : "Staff assignment removed.", actorName: user.name, createdAt: new Date().toISOString() });
      }
    }
    if (updates.priority) item.priority = updates.priority;
    item.updatedAt = new Date().toISOString();
    writeStore(data);
    return item;
  }
};
