
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type EventItem = {
  id: number;
  title: string;
  subject: string;
  type: string;
  event_date: string;
};

type TaskItem = {
  id: number;
  title: string;
  due_date: string;
};

type SessionItem = {
  id: number;
  subject: string;
  topic: string;
  session_date: string;
  start_time: string;
  end_time: string;
  purpose: string;
};

type DashboardData = {
  events: EventItem[];
  tasks: TaskItem[];
  sessions: SessionItem[];
};

function parseToolData<T>(value: unknown): T[] {
  if (!Array.isArray(value) || value.length === 0) return [];

  const text = value.find(
    (item): item is { text: string } =>
      typeof item?.text === "string"
  )?.text;

  if (!text) return [];

  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function App() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData>({
    events: [],
    tasks: [],
    sessions: [],
  });
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError("");

    try {
      const response = await fetch("/api/dashboard");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Couldn't load dashboard data.");
      }

      setDashboard({
        events: parseToolData<EventItem>(data.events),
        tasks: parseToolData<TaskItem>(data.tasks),
        sessions: parseToolData<SessionItem>(data.sessions),
      });
    } catch {
      setDashboardError(
        "Couldn't load your dashboard. Check that the API and MCP servers are running."
      );
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const userMessage = message.trim();
    if (!userMessage || loading) return;

    setLoading(true);
    setReply("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The StudyMate request failed.");
      }

      setReply(data.reply || "StudyMate returned an empty response.");
      setMessage("");

      // Refresh dashboard data after a successful chat action.
      await loadDashboard();
    } catch (error) {
      setReply(
        error instanceof Error
          ? error.message
          : "Couldn't connect to StudyMate. Check that all servers are running."
      );
    } finally {
      setLoading(false);
    }
  }

  const upcomingEvents = [...dashboard.events]
    .filter((item) => item.event_date >= "2026-10-09")
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const upcomingTasks = [...dashboard.tasks]
    .filter((item) => item.due_date >= "2026-10-09")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const upcomingSessions = [...dashboard.sessions]
    .filter((item) => item.session_date >= "2026-10-09")
    .sort((a, b) => {
      const dateCompare = a.session_date.localeCompare(b.session_date);
      return dateCompare || a.start_time.localeCompare(b.start_time);
    });

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">S</div>
          <span>StudyMate</span>
        </div>
        <div className="status">
          <span className="status-dot"></span>
          Your study space
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR PERSONAL STUDY ASSISTANT</p>
        <h1>Make every study session count.</h1>
        <p className="hero-text">
          Organize your deadlines, plan your sessions, and stay on track.
        </p>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR OVERVIEW</p>
            <h2>Stay on top of your studies.</h2>
          </div>
          <button
            className="suggestion"
            type="button"
            onClick={() => void loadDashboard()}
            disabled={dashboardLoading}
          >
            {dashboardLoading ? "Refreshing..." : "Refresh ↻"}
          </button>
        </div>

        {dashboardError && (
          <p className="dashboard-error" role="alert">
            {dashboardError}
          </p>
        )}

        {dashboardLoading ? (
          <p>Loading your study data...</p>
        ) : (
          <div className="dashboard-grid">
            <section className="dashboard-card">
              <div className="dashboard-card-heading">
                <span className="card-icon event-icon">▦</span>
                <div>
                  <p className="card-label">UPCOMING EVENTS</p>
                  <h3>{upcomingEvents.length}</h3>
                </div>
              </div>

              {upcomingEvents.length === 0 ? (
                <p className="empty-state">No upcoming events.</p>
              ) : (
                <ul className="dashboard-list">
                  {upcomingEvents.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <span>{item.subject} · {formatDate(item.event_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dashboard-card">
              <div className="dashboard-card-heading">
                <span className="card-icon task-icon">✓</span>
                <div>
                  <p className="card-label">PENDING TASKS</p>
                  <h3>{upcomingTasks.length}</h3>
                </div>
              </div>

              {upcomingTasks.length === 0 ? (
                <p className="empty-state">No pending tasks.</p>
              ) : (
                <ul className="dashboard-list">
                  {upcomingTasks.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <span>Due {formatDate(item.due_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dashboard-card">
              <div className="dashboard-card-heading">
                <span className="card-icon session-icon">▤</span>
                <div>
                  <p className="card-label">UPCOMING SESSIONS</p>
                  <h3>{upcomingSessions.length}</h3>
                </div>
              </div>

              {upcomingSessions.length === 0 ? (
                <p className="empty-state">No upcoming study sessions.</p>
              ) : (
                <ul className="dashboard-list">
                  {upcomingSessions.map((item) => (
                    <li key={item.id}>
                      <strong>{item.subject}: {item.topic}</strong>
                      <span>
                        {formatDate(item.session_date)} · {item.start_time}–{item.end_time}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </section>

      <section className="chat-card">
        <div className="chat-heading">
          <div>
            <p className="eyebrow">STUDYMATE AI</p>
            <h2>What are we working on?</h2>
          </div>
          <div className="ai-icon">✦</div>
        </div>

        <p className="chat-description">
          Ask about your deadlines, study plan, saved notes, or schedule.
        </p>

        <div className="suggestions">
          {[
            "What's coming up?",
            "Plan my study sessions",
            "Show my saved notes",
          ].map((suggestion) => (
            <button
              className="suggestion"
              key={suggestion}
              type="button"
              disabled={loading}
              onClick={() => setMessage(suggestion)}
            >
              {suggestion} <span>↗</span>
            </button>
          ))}
        </div>

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell StudyMate what you need..."
            aria-label="Message StudyMate"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !message.trim()}>
            {loading ? "Thinking..." : "Send ↗"}
          </button>
        </form>

        {loading && (
          <p className="reply" role="status">
            StudyMate is checking your study data...
          </p>
        )}

        {reply && !loading && (
          <div className="reply" role="status">
            <strong>StudyMate</strong>
            <div className="markdown-reply">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reply}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </section>

      <footer className="footer">
        <span>StudyMate</span>
        <span>Turn deadlines into a plan, and plans into progress.</span>
      </footer>
    </main>
  );
}

export default App;
