import "./App.css";
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";
const TOKEN_KEY = "jobtrack_token";
const USER_KEY = "jobtrack_user";

const STATUSES = [
  "Applied",
  "Assessment",
  "Interview",
  "Selected",
  "Rejected",
];

const EMPTY_FORM = {
  company: "",
  role: "",
  link: "",
  status: "Applied",
  date: "",
};

const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

// Attach the JWT to protected API requests.
async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    window.dispatchEvent(new Event("jobtrack-unauthorized"));
  }

  return response;
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY)
  );
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [checking, setChecking] = useState(Boolean(token));

  function saveSession(data) {
    sessionStorage.setItem(TOKEN_KEY, data.access_token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setChecking(false);
  }

  useEffect(() => {
    function handleUnauthorized() {
      logout();
    }

    window.addEventListener(
      "jobtrack-unauthorized",
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        "jobtrack-unauthorized",
        handleUnauthorized
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      if (!token) {
        setChecking(false);
        return;
      }

      setChecking(true);

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const currentUser = await response.json();

        if (!cancelled) {
          setUser(currentUser);
          sessionStorage.setItem(
            USER_KEY,
            JSON.stringify(currentUser)
          );
        }
      } catch {
        if (!cancelled) {
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ token, user, checking, saveSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { token, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return <div className="auth-loading">Checking your session...</div>;
  }

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}

function GuestRoute({ children }) {
  const { token, checking } = useAuth();

  if (checking) {
    return <div className="auth-loading">Checking your session...</div>;
  }

  return token ? <Navigate to="/dashboard" replace /> : children;
}

// Shared authentication page layout.
function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/login" className="auth-brand">
          JobTrack<span>.</span>
        </Link>

        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>

        {children}

        <p className="auth-footer">
          Organize your next career move.
        </p>
      </section>
    </main>
  );
}

function Login() {
  const { saveSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to log in. Check your details."
        );
      }

      saveSession(data);
      navigate(location.state?.from || "/dashboard", {
        replace: true,
      });
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the backend. Check FastAPI."
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to manage your job applications."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <p className="auth-error" role="alert">{error}</p>}

        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </label>

        <button className="primary-btn auth-submit" disabled={busy}>
          {busy ? "Logging in..." : "Log in"}
        </button>

        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function Signup() {
  const { saveSession } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to create your account."
        );
      }

      saveSession(data);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the backend. Check FastAPI."
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start organizing your job search."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <p className="auth-error" role="alert">{error}</p>}

        <label>
          Full name
          <input
            autoComplete="name"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>

        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </label>

        <button className="primary-btn auth-submit" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </button>

        <p className="auth-switch">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");

  async function loadJobs() {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/jobs");

      if (!response.ok) {
        throw new Error("Unable to load applications.");
      }

      setJobs(await response.json());
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to FastAPI. Check the backend."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await apiRequest("/jobs", {
        method: "POST",
        body: JSON.stringify({
          company: form.company.trim(),
          role: form.role.trim(),
          link: form.link.trim() || null,
          status: form.status,
          date: form.date,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to save application."
        );
      }

      setJobs((previous) => [data, ...previous]);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Unable to save application.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(job, newStatus) {
    const oldStatus = job.status;
    setError("");

    setJobs((previous) =>
      previous.map((item) =>
        item.id === job.id ? { ...item, status: newStatus } : item
      )
    );

    try {
      const response = await apiRequest(`/jobs/${job.id}`, {
        method: "PUT",
        body: JSON.stringify({
          company: job.company,
          role: job.role,
          link: job.link || null,
          status: newStatus,
          date: job.date,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to update status."
        );
      }

      setJobs((previous) =>
        previous.map((item) => item.id === job.id ? data : item)
      );
    } catch (err) {
      setJobs((previous) =>
        previous.map((item) =>
          item.id === job.id ? { ...item, status: oldStatus } : item
        )
      );
      setError(err.message || "Unable to update status.");
    }
  }

  async function deleteJob(id) {
    if (!window.confirm("Delete this job application?")) return;

    setError("");

    try {
      const response = await apiRequest(`/jobs/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to delete application.");
      }

      setJobs((previous) => previous.filter((job) => job.id !== id));
    } catch (err) {
      setError(err.message || "Unable to delete application.");
    }
  }

  const count = (status) =>
    jobs.filter((job) => job.status === status).length;

  const query = search.trim().toLowerCase();

  const filteredJobs = jobs
    .filter((job) => {
      const matchesSearch =
        (job.company || "").toLowerCase().includes(query) ||
        (job.role || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || job.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const comparison = (a.date || "").localeCompare(b.date || "");
      return sortOrder === "newest" ? -comparison : comparison;
    });

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/dashboard" className="brand">
          JobTrack<span>.</span>
        </Link>

        <p className="menu-label">WORKSPACE</p>
        <Link className="nav-item active" to="/dashboard">
          ▦ &nbsp; Dashboard
        </Link>
        <Link className="nav-item" to="/applications">
          ▤ &nbsp; Applications
        </Link>
        <Link className="nav-item" to="/interviews">
          ▣ &nbsp; Interviews
        </Link>

        <div className="sidebar-note">
          <strong>Keep going, {user?.name || "there"}!</strong>
          <p>Every application brings you one step closer to your goal.</p>
        </div>

        <div className="sidebar-account">
          <span className="account-name">{user?.name}</span>
          <span className="account-email">{user?.email}</span>
          <button className="secondary-btn logout-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR CAREER WORKSPACE</p>
            <h1>Dashboard</h1>
            <p className="subtitle">
              Track your applications and take the next step in your career.
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={() => {
              setError("");
              setShowForm((previous) => !previous);
            }}
          >
            + Add application
          </button>
        </header>

        {error && (
          <div className="auth-error" role="alert">
            {error}
            <button onClick={loadJobs}>Retry</button>
          </div>
        )}

        <section className="stats">
          {[
            ["Total applications", jobs.length, "All your job applications"],
            ["Interviews", count("Interview"), "Opportunities to shine"],
            ["Assessments", count("Assessment"), "Tests and assignments"],
            ["Selected", count("Selected"), "Offers and successes"],
          ].map(([label, value, description]) => (
            <div className="stat-card" key={label}>
              <p>{label}</p>
              <h2>{value}</h2>
              <span>{description}</span>
            </div>
          ))}
        </section>

        {showForm && (
          <section className="form-card">
            <h2>Add a job application</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>
                  Company name *
                  <input
                    required
                    maxLength={150}
                    value={form.company}
                    placeholder="e.g. Amazon"
                    onChange={(e) =>
                      setForm({ ...form, company: e.target.value })
                    }
                  />
                </label>

                <label>
                  Job title *
                  <input
                    required
                    maxLength={150}
                    value={form.role}
                    placeholder="e.g. Graduate Engineer Trainee"
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value })
                    }
                  />
                </label>

                <label>
                  Job link
                  <input
                    type="url"
                    value={form.link}
                    placeholder="https://..."
                    onChange={(e) =>
                      setForm({ ...form, link: e.target.value })
                    }
                  />
                </label>

                <label>
                  Application date *
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) =>
                      setForm({ ...form, date: e.target.value })
                    }
                  />
                </label>

                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    {STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save application"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="table-card">
          <div className="table-heading">
            <div>
              <h2>Recent applications</h2>
              <p>Your job search activity in one place.</p>
            </div>
            <span className="count-badge">
              {jobs.length} applications
            </span>
          </div>

          <div className="job-filters">
            <input
              type="search"
              placeholder="Search company or job title..."
              aria-label="Search applications"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <select
              aria-label="Sort by date"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Loading applications...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="empty-state">
              <h3>{jobs.length ? "No matching applications" : "No applications yet"}</h3>
              <p>
                {jobs.length
                  ? "Try another search or status filter."
                  : "Add your first application to track your progress."}
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>COMPANY / ROLE</th>
                    <th>DATE</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <strong>{job.company}</strong>
                        <p className="role-name">{job.role}</p>
                        {job.link && (
                          <a href={job.link} target="_blank" rel="noreferrer">
                            View job
                          </a>
                        )}
                      </td>
                      <td>{job.date}</td>
                      <td>
                        <select
                          className={`status-select status-${job.status.toLowerCase()}`}
                          value={job.status}
                          aria-label={`Status for ${job.company}`}
                          onChange={(e) =>
                            handleStatusChange(job, e.target.value)
                          }
                        >
                          {STATUSES.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className="delete-btn"
                          onClick={() => deleteJob(job.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer>JobTrack · Built to organize your next career move.</footer>
      </main>
    </div>
  );
}

function ApplicationsPage() {
  return <Dashboard />;
}

function InterviewsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/dashboard" className="brand">JobTrack<span>.</span></Link>
        <p className="menu-label">WORKSPACE</p>
        <Link className="nav-item" to="/dashboard">▦ &nbsp; Dashboard</Link>
        <Link className="nav-item" to="/applications">▤ &nbsp; Applications</Link>
        <Link className="nav-item active" to="/interviews">▣ &nbsp; Interviews</Link>
        <div className="sidebar-account">
          <span className="account-name">{user?.name}</span>
          <button className="secondary-btn logout-btn" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR CAREER WORKSPACE</p>
            <h1>Interviews</h1>
            <p className="subtitle">Your applications currently marked as Interview.</p>
          </div>
        </header>
        <section className="table-card">
          <p>
            Manage your applications from the Applications page. Interview
            scheduling and preparation notes can be added as the next feature.
          </p>
          <Link className="primary-btn" to="/applications">
            View applications
          </Link>
        </section>
      </main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />

      <Route
        path="/signup"
        element={
          <GuestRoute>
            <Signup />
          </GuestRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/applications"
        element={
          <ProtectedRoute>
            <ApplicationsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/interviews"
        element={
          <ProtectedRoute>
            <InterviewsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
