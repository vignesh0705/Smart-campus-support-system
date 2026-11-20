import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, Bell, CheckCircle2, ChevronDown,
  CircleHelp, ClipboardList, Clock3, FileText, Filter, LayoutDashboard, LogOut, MapPin, Menu,
  MessageSquareText, Plus, Search, ShieldCheck, Sparkles, UserRound, X, Zap
} from "lucide-react";
import { api, connectApi } from "./api.js";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "complaints", label: "All complaints", icon: ClipboardList },
  { id: "activity", label: "Activity", icon: Activity }
];

const roleCopy = {
  student: { label: "Student workspace", greeting: "Your campus, taken care of", subtitle: "Raise an issue and keep an eye on what happens next." },
  admin: { label: "Operations workspace", greeting: "Good morning", subtitle: "Here’s what’s happening across campus today." },
  staff: { label: "Maintenance workspace", greeting: "Your work, made simpler", subtitle: "See the issues assigned to you and keep students in the loop." }
};

const statusNames = { submitted: "Submitted", "in-progress": "In progress", resolved: "Resolved", rejected: "Rejected" };
const currentYear = new Date().getFullYear();

function dateLabel(value) {
  const date = new Date(value);
  const now = new Date();
  const diff = Math.max(0, Math.floor((now - date) / 86400000));
  if (diff === 0) return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("campuscare-user") || "null"); } catch { return null; }
  });
  const [apiReady, setApiReady] = useState(null);
  const [items, setItems] = useState([]);
  const [staff, setStaff] = useState([]);
  const [section, setSection] = useState("overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { connectApi().then(setApiReady); }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!user || apiReady === null) return;
    if (!silent) setRefreshing(true);
    try {
      const data = await api.getComplaints();
      setItems(data);
      if (user.role === "admin") setStaff(await api.getStaff());
    } catch (error) {
      setToast(error.message);
    } finally {
      setRefreshing(false);
    }
  }, [user, apiReady]);

  useEffect(() => {
    refresh();
    if (!user || apiReady === null) return undefined;
    const timer = window.setInterval(() => refresh(true), 30000);
    const handleFocus = () => refresh(true);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user, apiReady, refresh]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => items.filter((item) => {
    const matchText = `${item.title} ${item.location} ${item.category} ${item.student?.name || ""}`.toLowerCase().includes(query.toLowerCase());
    return matchText && (statusFilter === "all" || item.status === statusFilter) && (priorityFilter === "all" || item.priority === priorityFilter);
  }), [items, query, statusFilter, priorityFilter]);

  async function handleSignIn(result) {
    localStorage.setItem("campuscare-token", result.token);
    localStorage.setItem("campuscare-user", JSON.stringify(result.user));
    setUser(result.user);
  }

  function signOut() {
    localStorage.removeItem("campuscare-token");
    localStorage.removeItem("campuscare-user");
    setUser(null);
    setItems([]);
    setSection("overview");
  }

  async function createComplaint(payload) {
    const created = await api.createComplaint(payload);
    setItems((current) => [created, ...current]);
    setShowNew(false);
    setToast("Your complaint is in. We’ll keep you updated.");
    setSection("complaints");
  }

  async function updateComplaint(id, updates) {
    try {
      const updated = await api.updateComplaint(id, updates);
      setItems((current) => current.map((item) => item.id === id ? updated : item));
      setToast("Complaint updated successfully.");
    } catch (error) {
      setToast(error.message);
    }
  }

  if (!user) {
    return <Login onSignIn={handleSignIn} apiReady={apiReady} />;
  }

  const copy = roleCopy[user.role] || roleCopy.student;
  const isStudent = user.role === "student";
  const title = section === "overview"
    ? user.role === "admin" ? `${copy.greeting}, ${user.name.split(" ")[0]}` : copy.greeting
    : section === "activity" ? "Recent activity" : isStudent ? "My complaints" : "Complaint desk";
  const notifications = items.flatMap((item) => (item.history || []).slice(-1).map((entry) => ({ ...entry, complaint: item }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection("overview"); }}>
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span>campus<span className="brand-light">care</span><small>SMART CAMPUS SUPPORT</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="role-pill"><span className={`role-dot ${user.role}`} />{copy.label}<ChevronDown size={14} /></div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-heading">MENU</p>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${section === id ? "nav-active" : ""}`} onClick={() => { setSection(id); setMobileOpen(false); }}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{id === "complaints" && <span className="nav-count">{items.length}</span>}
            </button>
          ))}
          {isStudent && <button className="nav-link" onClick={() => setShowNew(true)}><Plus size={18} /><span>New complaint</span></button>}
        </nav>
        <div className="sidebar-bottom">
          <div className="campus-card">
            <div className="campus-card-icon"><Sparkles size={16} /></div>
            <strong>Campus, in sync.</strong>
            <p>Every report helps make this a better place to learn.</p>
            <div className="campus-card-line"><span /></div>
            <small>SUPPORT THAT SHOWS UP</small>
          </div>
          <button className="nav-link help-link" onClick={() => setToast("Need help? Contact campus facilities at facilities@campus.edu.")}><CircleHelp size={18} /><span>Help & support</span></button>
          <div className="profile">
            <div className="avatar">{user.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div>
            <div className="profile-info"><strong>{user.name}</strong><span>{user.role}</span></div>
            <button className="icon-btn logout-btn" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>CampusCare</span><span className="crumb-slash">/</span><strong>{section === "overview" ? "Overview" : section === "activity" ? "Activity" : "Complaints"}</strong></div>
          <div className="topbar-right">
            <div className="campus-select"><span className="campus-live" />Northbridge University <ChevronDown size={14} /></div>
            <button className={`icon-btn notification-btn ${showNotifications ? "icon-selected" : ""}`} onClick={() => { if (!showNotifications) refresh(true); setShowNotifications((shown) => !shown); }} aria-label="Notifications">
              <Bell size={19} /><i />
            </button>
            <button className="top-avatar" title={user.name}>{user.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</button>
          </div>
          {showNotifications && <div className="notification-popover"><div className="popover-heading"><strong>Latest updates</strong><span>{notifications.length} recent</span></div>{notifications.length ? notifications.map(({ complaint, note, createdAt }, index) => <div className="notification-item" key={`${complaint.id}-${index}`}><span className="notification-dot" /><div><strong>{complaint.title}</strong><p>{note}</p><small>{dateLabel(createdAt)}</small></div></div>) : <p className="empty-note">Updates will show here.</p>}</div>}
        </header>

        <div className="page-content">
          {section !== "activity" && <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line" />{copy.label.toUpperCase()}</div><h1>{title}<span className="title-period">.</span></h1><p>{copy.subtitle}</p></div>
            <div className="welcome-actions">
              <span className="last-updated"><span className="live-dot" />Live updates</span>
              {isStudent && <button className="button button-primary" onClick={() => setShowNew(true)}><Plus size={17} />Report an issue</button>}
              {!isStudent && <button className="button button-secondary" onClick={() => refresh()} disabled={refreshing}><Activity size={16} className={refreshing ? "spin" : ""} />Refresh</button>}
            </div>
          </section>}

          {(section === "overview") && <Overview
            user={user} items={items} onCreate={() => setShowNew(true)}
            onNavigate={setSection} onUpdate={updateComplaint} staff={staff}
          />}
          {(section === "complaints" || section === "activity") && <ComplaintList
            items={filtered} allItems={items} user={user} query={query} setQuery={setQuery}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter}
            onUpdate={updateComplaint} staff={staff} activity={section === "activity"}
          />}
          <footer className="footer"><span>© {currentYear} CampusCare</span><span>Made for a campus that cares <span className="footer-heart">♥</span></span><span className="footer-status"><span className="live-dot" />{apiReady === false ? "Interactive preview mode" : "All systems operational"}</span></footer>
        </div>
      </main>

      {showNew && <NewComplaintModal onClose={() => setShowNew(false)} onSubmit={createComplaint} />}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}<button onClick={() => setToast("")} aria-label="Dismiss"><X size={15} /></button></div>}
      {apiReady === false && <div className="demo-banner"><Sparkles size={14} />Preview mode · This browser only; reports won’t reach admins or MongoDB</div>}
    </div>
  );
}

function Login({ onSignIn, apiReady }) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = register ? await api.register(name, email, password) : await api.login(email, password);
      onSignIn(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function chooseDemo(account) {
    setEmail(account.email);
    setPassword("Campus123!");
    setRegister(false);
    setError("");
  }

  return (
    <div className="login-shell">
      <div className="login-left">
        <a className="brand login-brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span>campus<span className="brand-light">care</span><small>SMART CAMPUS SUPPORT</small></span>
        </a>
        <div className="login-copy">
          <div className="eyebrow light-eyebrow"><span className="eyebrow-line" />A BETTER CAMPUS, TOGETHER</div>
          <h1>Small fixes.<br /><span>Big difference.</span></h1>
          <p>From a flickering light to a room that needs a little love — tell us what’s up. We’ll make sure it gets to the right people.</p>
          <div className="login-stats"><div><strong>1,248</strong><span>ISSUES RESOLVED</span></div><i /><div><strong>4.8<span className="stat-star">★</span></strong><span>STUDENT RATING</span></div></div>
        </div>
        <div className="login-decoration"><div className="decor-orbit orbit-one" /><div className="decor-orbit orbit-two" /><div className="decor-orbit orbit-three" /><div className="decor-center"><Zap size={28} fill="currentColor" /></div><div className="decor-label label-top">ONE CAMPUS</div><div className="decor-label label-bottom">BETTER, TOGETHER</div></div>
        <div className="login-left-foot"><span>© {currentYear} Northbridge University</span><span>Built for campus life <span className="footer-heart">♥</span></span></div>
      </div>
      <div className="login-right">
        <div className="login-topnote"><span><span className="live-dot" />Northbridge University</span><span>Need help? <a href="mailto:facilities@campus.edu">Get in touch</a></span></div>
        <div className="login-form-wrap">
          <div className="mobile-login-brand"><span className="brand-mark"><span /><span /><span /><span /></span><b>campus<span className="brand-light">care</span></b></div>
          <div className="eyebrow"><span className="eyebrow-line" />{register ? "YOUR CAMPUS ACCOUNT" : "WELCOME BACK"}</div>
          <h2>{register ? "Join your campus." : "Good to see you."}</h2>
          <p className="login-intro">{register ? "Create your account and let’s take care of campus together." : "Sign in to keep your campus running smoothly."}</p>
          <form onSubmit={submit} className="login-form">
            {register && <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" autoComplete="name" required minLength={2} /></label>}
            <label>Campus email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@campus.edu" autoComplete="email" required /></label>
            <label>Password<div className="password-wrap"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={register ? "At least 8 characters" : "Enter your password"} autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 8 : undefined} />{!register && <button type="button" className="forgot-link" onClick={() => setError("For this demo, use the password shown in the demo account list.")}>Forgot?</button>}</div></label>
            {error && <div className="form-error">{error}</div>}
            <button className="button button-primary login-submit" disabled={busy}>{busy ? "One moment..." : register ? "Create your account" : "Sign in"}<ArrowRight size={17} /></button>
          </form>
          <div className="account-switch">{register ? "Already have an account?" : "New to campus care?"} <button onClick={() => { setRegister((value) => !value); setError(""); }}>{register ? "Sign in" : "Create an account"}</button></div>
          <div className="secure-note"><ShieldCheck size={15} />Your campus account is private and secure.</div>
          <button className="demo-toggle" onClick={() => setShowDemo((value) => !value)}><Sparkles size={15} />{showDemo ? "Hide preview accounts" : "Explore a demo account"}<ChevronDown size={14} className={showDemo ? "rotate-chevron" : ""} /></button>
          {showDemo && <div className="demo-accounts">{[
            ["student", "student@campus.edu", "Alex Morgan"],
            ["admin", "admin@campus.edu", "Jordan Lee"],
            ["staff", "staff@campus.edu", "Taylor Reed"]
          ].map(([role, accountEmail, accountName]) => <button key={role} onClick={() => chooseDemo({ email: accountEmail })}><span className={`mini-role ${role}`}><UserRound size={14} /></span><span><b>{accountName}</b><small>{role} workspace</small></span><ArrowUpRight size={15} /></button>)}
            <small className="demo-password">Password for all demo accounts: <b>Campus123!</b></small>
          </div>}
          {apiReady === false && <div className="local-mode"><span className="live-dot" />Interactive preview mode is ready</div>}
        </div>
        <div className="login-right-foot"><span>Privacy</span><span>Terms</span><span>© {currentYear} CampusCare</span></div>
      </div>
    </div>
  );
}

function Overview({ user, items, onCreate, onNavigate, onUpdate, staff }) {
  const isAdmin = user.role === "admin";
  const isStaff = user.role === "staff";
  const resolved = items.filter((item) => item.status === "resolved").length;
  const open = items.filter((item) => !["resolved", "rejected"].includes(item.status)).length;
  const urgent = items.filter((item) => item.priority === "urgent" && !["resolved", "rejected"].includes(item.status)).length;
  const stats = isAdmin
    ? [{ label: "Total requests", value: items.length, change: "Across campus", icon: ClipboardList, tint: "blue" }, { label: "Needs attention", value: open, change: "Open right now", icon: Clock3, tint: "amber" }, { label: "Resolved", value: resolved, change: "Nice work, team", icon: CheckCircle2, tint: "green" }, { label: "Urgent priority", value: urgent, change: urgent ? "Needs a quick look" : "All clear", icon: Zap, tint: "rose" }]
    : isStaff
      ? [{ label: "Assigned to me", value: items.length, change: "Your work queue", icon: ClipboardList, tint: "blue" }, { label: "In progress", value: items.filter((item) => item.status === "in-progress").length, change: "Currently underway", icon: Activity, tint: "amber" }, { label: "Resolved", value: resolved, change: "You made a difference", icon: CheckCircle2, tint: "green" }, { label: "Urgent", value: urgent, change: "Prioritize these", icon: Zap, tint: "rose" }]
      : [{ label: "My requests", value: items.length, change: "Your campus reports", icon: ClipboardList, tint: "blue" }, { label: "In progress", value: items.filter((item) => item.status === "in-progress").length, change: "Being taken care of", icon: Activity, tint: "amber" }, { label: "Resolved", value: resolved, change: "Campus, a little better", icon: CheckCircle2, tint: "green" }, { label: "Awaiting review", value: items.filter((item) => item.status === "submitted").length, change: "We’ve got them", icon: Clock3, tint: "purple" }];
  const latest = [...items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);

  return (
    <>
      {isAdmin && <div className="insight-banner"><div className="insight-icon"><Sparkles size={18} /></div><div><strong>Today’s campus pulse</strong><p>{urgent ? `${urgent} urgent ${urgent === 1 ? "issue needs" : "issues need"} your attention.` : "Everything is moving along. Your teams are keeping campus in great shape."} <span>Smart triage is helping route reports faster.</span></p></div><span className="pulse-tag">LIVE INSIGHT</span><ArrowUpRight size={18} className="insight-arrow" /></div>}
      <div className="stats-grid">{stats.map(({ label, value, change, icon: Icon, tint }, index) => <article className={`stat-card stat-${tint}`} key={label} style={{ "--card-index": index }}><div className="stat-top"><span className="stat-icon"><Icon size={18} /></span><span className="stat-more"><ArrowUpRight size={15} /></span></div><div className="stat-value">{value.toString().padStart(2, "0")}</div><div className="stat-label">{label}</div><div className="stat-change"><span className="stat-change-dot" />{change}</div></article>)}</div>
      <div className="dashboard-grid">
        <section className="panel request-panel">
          <div className="panel-heading"><div><span className="panel-kicker">{isStaff ? "YOUR WORK QUEUE" : isAdmin ? "CAMPUS-WIDE" : "YOUR REQUESTS"}</span><h2>{isAdmin ? "Latest complaints" : isStaff ? "Assigned to you" : "Recent requests"}</h2></div><button className="text-link" onClick={() => onNavigate("complaints")}>View all <ArrowRight size={15} /></button></div>
          {latest.length ? <div className="request-list">{latest.map((item, index) => <ComplaintRow key={item.id} item={item} index={index} compact user={user} onUpdate={onUpdate} staff={staff} />)}</div> : <EmptyState student={user.role === "student"} onCreate={onCreate} />}
        </section>
        <aside className="right-rail">
          {user.role === "student" ? <CampusTip onCreate={onCreate} /> : <div className="panel workload-panel"><div className="panel-heading"><div><span className="panel-kicker">AT A GLANCE</span><h2>Request status</h2></div><Activity size={17} className="rail-heading-icon" /></div><StatusOverview items={items} /></div>}
          <div className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">JUST HAPPENED</span><h2>Latest activity</h2></div><button className="text-link small-link" onClick={() => onNavigate("activity")}>See all <ArrowRight size={14} /></button></div><ActivityFeed items={items.slice(0, 3)} /></div>
        </aside>
      </div>
      <div className="bottom-note"><div className="note-icon"><ShieldCheck size={17} /></div><div><strong>Every report matters.</strong><span>Our facilities team reviews new requests throughout the day.</span></div><span className="note-response"><span className="live-dot" />Typically responds within 24h</span></div>
    </>
  );
}

function ComplaintList({ items, allItems, user, query, setQuery, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, onUpdate, staff, activity }) {
  const isAdmin = user.role === "admin";
  return (
    <section className="panel full-list-panel">
      <div className="panel-heading list-heading"><div><span className="panel-kicker">{activity ? "WHAT’S MOVING" : isAdmin ? "CAMPUS-WIDE OVERVIEW" : user.role === "staff" ? "YOUR ASSIGNED REQUESTS" : "YOUR CAMPUS REPORTS"}</span><h2>{activity ? "Recent activity" : "All complaints"} <span className="heading-count">{allItems.length}</span></h2></div>{user.role === "student" && <span className="view-summary"><span className="live-dot" />Updated live</span>}</div>
      <div className="toolbar"><div className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, location or category" /><kbd>⌘ K</kbd></div><div className="filter-control"><Filter size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="submitted">Submitted</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select><ChevronDown size={14} /></div><div className="filter-control priority-control"><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filter by priority"><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><ChevronDown size={14} /></div></div>
      <div className={`table-header ${isAdmin ? "admin-table-header" : ""}`}><span>REQUEST</span><span>STATUS</span><span>PRIORITY</span>{isAdmin && <span>ASSIGNED TO</span>}<span>LAST UPDATED</span></div>
      {items.length ? <div className="table-body">{items.map((item, index) => <ComplaintRow key={item.id} item={item} index={index} user={user} onUpdate={onUpdate} staff={staff} isAdmin={isAdmin} />)}</div> : <div className="no-results"><div className="no-results-icon"><Search size={20} /></div><strong>No complaints found</strong><p>Try a different search or adjust your filters.</p></div>}
      <div className="table-footer"><span>Showing <strong>{items.length}</strong> of <strong>{allItems.length}</strong> complaints</span><div className="pager"><button disabled aria-label="Previous page"><ArrowLeft size={15} /></button><button className="page-active">1</button><button disabled aria-label="Next page"><ArrowRight size={15} /></button></div></div>
    </section>
  );
}

function ComplaintRow({ item, index, user, onUpdate, staff, isAdmin, compact }) {
  const isStaff = user.role === "staff";
  return (
    <article className={`complaint-row ${isAdmin ? "admin-row" : ""} ${compact ? "compact-row" : ""}`} style={{ "--row-index": index }}>
      <div className="request-cell"><div className={`category-icon category-${item.category.toLowerCase().replace(/[^a-z]+/g, "-")}`}><CategoryIcon category={item.category} /></div><div className="request-copy"><div className="request-title">{item.title}{item.priority === "urgent" && <span className="urgent-flag"><Zap size={11} fill="currentColor" />URGENT</span>}</div><div className="request-meta"><span>{item.id}</span><i />{item.location}<i />{item.category}{isAdmin && <><i /><span className="student-name">By {item.student?.name || "Student"}</span></>}</div></div></div>
      <div className="status-cell"><span className={`status-chip status-${item.status}`}><span />{statusNames[item.status] || item.status}</span></div>
      <div className="priority-cell"><span className={`priority-chip priority-${item.priority}`}><span />{item.priority}</span></div>
      {isAdmin && <div className="assigned-cell"><select value={item.assignedTo?.id || ""} onChange={(event) => onUpdate(item.id, { assignedTo: event.target.value })} aria-label={`Assign ${item.title}`}><option value="">Unassigned</option>{staff.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select><ChevronDown size={13} /></div>}
      <div className="updated-cell"><span>{dateLabel(item.updatedAt)}</span>{(isAdmin || isStaff) && !["resolved", "rejected"].includes(item.status) && <select className="status-update" value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value })} aria-label={`Update status for ${item.title}`}><option value="submitted">Mark submitted</option><option value="in-progress">Mark in progress</option><option value="resolved">Mark resolved</option><option value="rejected">Mark rejected</option></select>}</div>
      {compact && <div className="row-chevron"><ArrowRight size={15} /></div>}
    </article>
  );
}

function ActivityFeed({ items }) {
  if (!items.length) return <p className="empty-note">Activity will show up here.</p>;
  return <div className="activity-feed">{items.map((item, index) => {
    const update = item.history?.[item.history.length - 1];
    return <div className="feed-item" key={item.id}><span className={`feed-icon feed-${item.status}`}><Activity size={14} /></span><div className="feed-copy"><strong>{update?.note || item.title}</strong><span>{item.title}</span><small>{dateLabel(update?.createdAt || item.updatedAt)}</small></div>{index === 0 && <span className="new-indicator">NEW</span>}</div>;
  })}</div>;
}

function StatusOverview({ items }) {
  const counts = ["submitted", "in-progress", "resolved"].map((status) => ({ status, count: items.filter((item) => item.status === status).length }));
  const total = Math.max(items.length, 1);
  return <div className="status-overview"><div className="status-meter">{counts.map(({ status, count }) => <span className={`meter-${status}`} key={status} style={{ width: `${Math.max(count / total * 100, count ? 4 : 0)}%` }} />)}</div>{counts.map(({ status, count }) => <div className="status-overview-row" key={status}><span className={`status-chip status-${status}`}><span />{statusNames[status]}</span><b>{count.toString().padStart(2, "0")}</b></div>)}</div>;
}

function CampusTip({ onCreate }) {
  return <div className="tip-card"><div className="tip-art"><div className="tip-orbit" /><div className="tip-plant"><span /><span /><span /><span /></div><div className="tip-sun" /></div><span className="panel-kicker">A LITTLE CAMPUS WISDOM</span><h3>See something?<br />Say something.</h3><p>A quick report today can make someone’s tomorrow a little better.</p><button className="tip-link" onClick={onCreate}>Report an issue <ArrowRight size={15} /></button><div className="tip-watermark">CARE<span>.</span></div></div>;
}

function EmptyState({ student, onCreate }) {
  return <div className="empty-state"><div className="empty-illustration"><MessageSquareText size={23} /><span><Plus size={13} /></span></div><strong>{student ? "Your campus story starts here." : "Nothing in the queue yet."}</strong><p>{student ? "See something that needs attention? Let the right people know." : "No requests have been assigned yet."}</p>{student && <button className="button button-primary" onClick={onCreate}><Plus size={16} />Report your first issue</button>}</div>;
}

function CategoryIcon({ category }) {
  if (category === "Electrical") return <Zap size={17} />;
  if (category === "Plumbing") return <Activity size={17} />;
  if (category === "Cleaning") return <Sparkles size={17} />;
  if (category === "Network & IT") return <Activity size={17} />;
  if (category === "Safety") return <ShieldCheck size={17} />;
  return <FileText size={17} />;
}

function NewComplaintModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ title: "", description: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [triage, setTriage] = useState(null);
  function change(field, value) {
    const next = { ...form, [field]: value };
    setForm(next);
    if (field === "description" || field === "title") {
      const all = `${next.title} ${next.description}`.toLowerCase();
      const terms = [["Electrical", ["electric", "power", "light", "outlet"]], ["Plumbing", ["water", "leak", "pipe", "toilet"]], ["Network & IT", ["wifi", "internet", "projector", "computer"]], ["Cleaning", ["trash", "dirty", "clean", "garbage"]], ["Facilities", ["broken", "door", "window", "furniture"]]];
      const found = terms.find(([, words]) => words.some((word) => all.includes(word)));
      const urgent = ["fire", "smoke", "flood", "emergency", "injury", "unsafe"].some((word) => all.includes(word));
      setTriage(all.length > 10 ? { category: found?.[0] || "General", priority: urgent ? "urgent" : "medium" } : null);
    }
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="complaint-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-top"><div className="modal-icon"><MessageSquareText size={19} /></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={19} /></button></div><div className="eyebrow"><span className="eyebrow-line" />LET’S GET IT SORTED</div><h2 id="modal-title">Tell us what’s up.</h2><p className="modal-intro">A few details help us get the right people on it sooner.</p><form onSubmit={submit}><label>What needs attention?<input value={form.title} onChange={(event) => change("title", event.target.value)} placeholder="e.g. Lights out in the east stairwell" minLength={5} maxLength={120} required /></label><label>Where is it?<div className="input-icon-wrap"><MapPin size={16} /><input value={form.location} onChange={(event) => change("location", event.target.value)} placeholder="Building, floor or room" maxLength={120} required /></div></label><label>Tell us a little more<textarea value={form.description} onChange={(event) => change("description", event.target.value)} placeholder="What happened? When did you first notice it?" minLength={15} maxLength={3000} rows={4} required /><span className="field-hint">The more detail, the better — at least 15 characters.</span></label>{triage && <div className="ai-preview"><span className="ai-preview-icon"><Sparkles size={15} /></span><span><b>Smart triage preview</b><small>{triage.category} · <span className={`priority-text-${triage.priority}`}>{triage.priority} priority</span></small></span><span className="ai-ready">SUGGESTED</span></div>}{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "Sending..." : "Send report"}<ArrowRight size={16} /></button></div></form><div className="modal-privacy"><ShieldCheck size={14} />Shared with campus support. External AI use follows campus privacy settings.</div></section></div>;
}

export default App;
