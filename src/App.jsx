import { useEffect, useState } from "react";
import { account, tablesDB } from "./appwrite";
import {
  ID,
  Permission,
  Role,
} from "appwrite";

import "./App.css";

const DATABASE_ID = "6ae4c93e001f5705c7a2";
const TABLE_ID = "6ae4c99c002ca4ccdef5";

function App() {
  // Authentication
  const [user, setUser] = useState(null);
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Notes
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  // Search and Filter
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  // AI
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Messages
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Check logged-in user
  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await account.get();

      setUser(currentUser);
      await loadNotes();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  // Load notes
  async function loadNotes() {
    try {
      const response = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
      });

      setNotes(
        (response.rows || []).filter(
          (note) => note.userId === user?.$id ||
            note.userId === userIdForLoad
        )
      );
    } catch (error) {
      setMessage("Unable to load notes: " + error.message);
    }
  }

  // Authentication
  async function handleAuth(e) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        await account.createEmailPasswordSession({
          email,
          password,
        });
      } else {
        await account.create({
          userId: ID.unique(),
          email,
          password,
          name,
        });

        await account.createEmailPasswordSession({
          email,
          password,
        });
      }

      const currentUser = await account.get();

      setUser(currentUser);

      await loadNotesForUser(currentUser.$id);

    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  // Load notes for a particular user
  async function loadNotesForUser(userId) {
    try {
      const response = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
      });

      setNotes(
        (response.rows || []).filter(
          (note) => note.userId === userId
        )
      );
    } catch (error) {
      setMessage("Unable to load notes: " + error.message);
    }
  }

  // Add note
  async function addNote(e) {
    e.preventDefault();

    if (!user) return;

    setMessage("");

    try {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        rowId: ID.unique(),

        data: {
          title,
          subject,
          content,
          userId: user.$id,
        },

        permissions: [
          Permission.read(Role.user(user.$id)),
          Permission.update(Role.user(user.$id)),
          Permission.delete(Role.user(user.$id)),
        ],
      });

      setTitle("");
      setSubject("");
      setContent("");

      setMessage("Note saved successfully!");

      await loadNotesForUser(user.$id);

    } catch (error) {
      setMessage("Error saving note: " + error.message);
    }
  }

  // Delete note
  async function deleteNote(noteId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this note?"
    );

    if (!confirmed) return;

    try {
      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        rowId: noteId,
      });

      setMessage("Note deleted successfully!");

      await loadNotesForUser(user.$id);

    } catch (error) {
      setMessage("Error deleting note: " + error.message);
    }
  }

  // Logout
  async function logout() {
    try {
      await account.deleteSession({
        sessionId: "current",
      });

      setUser(null);
      setNotes([]);
      setMessage("");
      setAiResult("");

    } catch (error) {
      setMessage(error.message);
    }
  }

  // AI Assistant
  async function askAI(prompt) {
    setAiLoading(true);
    setAiResult("");

    try {
      const response = await fetch("/ollama/api/generate", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: "qwen2.5:1.5b",
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(
          "Ollama request failed. Check whether Ollama is running."
        );
      }

      const data = await response.json();

      setAiResult(data.response);

    } catch (error) {
      setAiResult(
        "AI Error: " +
        error.message +
        "\n\nMake sure Ollama is running and qwen2.5:1.5b is installed."
      );
    } finally {
      setAiLoading(false);
    }
  }

  // AI Summary
  function summarizeNote(note) {
    askAI(`
      You are a helpful study assistant.

      Summarize the following study notes
      in very simple English.

      Use headings and bullet points.

      Notes:
      ${note.content}
    `);
  }

  // AI Quiz
  function generateQuiz(note) {
    askAI(`
      You are an educational quiz generator.

      Create 5 multiple-choice questions
      based on these study notes.

      Give four options for every question.
      Mark the correct answer.
      Explain each answer briefly.

      Notes:
      ${note.content}
    `);
  }

  // AI Explanation
  function explainTopic(note) {
    askAI(`
      You are a friendly teacher.

      Explain these study notes in very simple English.

      Include:
      1. Simple definition
      2. Important points
      3. Easy examples
      4. Short conclusion

      Notes:
      ${note.content}
    `);
  }

  // Search and Filter
  const subjects = [
    "All",
    ...new Set(notes.map((note) => note.subject)),
  ];

  const filteredNotes = notes.filter((note) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      note.title?.toLowerCase().includes(searchText) ||
      note.content?.toLowerCase().includes(searchText) ||
      note.subject?.toLowerCase().includes(searchText);

    const matchesSubject =
      filter === "All" || note.subject === filter;

    return matchesSearch && matchesSubject;
  });

  // Loading Screen
  if (loading) {
    return (
      <div className="loading">
        <h2>📚 Loading AI Study Assistant...</h2>
      </div>
    );
  }

  // Login and Registration
  if (!user) {
    return (
      <div className="app-container">

        <div className="login-card">

          <h1>📚 AI Study Assistant</h1>

          <p className="subtitle">
            Your smart learning companion
          </p>

          <h2>
            {isLogin ? "Welcome Back!" : "Create Account"}
          </h2>

          <form onSubmit={handleAuth}>

            {!isLogin && (
              <input
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}

            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password (minimum 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />

            <button type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : isLogin
                ? "Login"
                : "Register"}
            </button>

          </form>

          {message && (
            <p className="message">{message}</p>
          )}

          <p className="switch-text">

            {isLogin
              ? "Don't have an account?"
              : "Already have an account?"}

            <span
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage("");
              }}
            >
              {isLogin ? " Register" : " Login"}
            </span>

          </p>

        </div>

      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="dashboard">

      {/* Navigation */}
      <header className="topbar">

        <h1>📚 AI Study Assistant</h1>

        <div className="user-info">

          <span>
            Welcome, {user.name || user.email}
          </span>

          <button
            className="logout-btn"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </header>

      <main className="dashboard-content">

        {/* Welcome */}
        <section className="welcome-section">

          <h2>Your Learning Dashboard 🎓</h2>

          <p>
            Learn smarter, organize your notes
            and improve your knowledge with AI.
          </p>

        </section>

        {/* Statistics */}
        <section className="stats">

          <div className="stat-card">
            <h3>{notes.length}</h3>
            <p>Total Study Notes</p>
          </div>

          <div className="stat-card">
            <h3>
              {new Set(notes.map((n) => n.subject)).size}
            </h3>
            <p>Total Subjects</p>
          </div>

        </section>

        {/* Add Notes */}
        <section className="note-form-section">

          <h2>➕ Add New Study Note</h2>

          <form onSubmit={addNote}>

            <input
              type="text"
              placeholder="Enter Note Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Enter Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />

            <textarea
              placeholder="Write your study notes here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows="5"
              required
            />

            <button type="submit">
              💾 Save Study Note
            </button>

          </form>

        </section>

        {message && (
          <p className="message">{message}</p>
        )}

        {/* AI Result */}
        {(aiLoading || aiResult) && (

          <section className="ai-result">

            <h2>🤖 AI Study Assistant</h2>

            {aiLoading ? (
              <p>AI is thinking... Please wait.</p>
            ) : (
              <>
                <div className="ai-output">
                  {aiResult}
                </div>

                <button
                  onClick={() => setAiResult("")}
                >
                  Clear Result
                </button>
              </>
            )}

          </section>

        )}

        {/* Notes */}
        <section className="notes-section">

          <h2>📖 Your Study Notes</h2>

          <div className="search-filter">

            <input
              type="text"
              placeholder="🔍 Search your notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >

              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}

            </select>

          </div>

          <div className="notes-grid">

            {filteredNotes.map((note) => (

              <div className="note-card" key={note.$id}>

                <h3>{note.title}</h3>

                <span className="subject-tag">
                  {note.subject}
                </span>

                <p>{note.content}</p>

                {/* AI Features */}
                <div className="ai-buttons">

                  <button
                    onClick={() => summarizeNote(note)}
                    disabled={aiLoading}
                  >
                    📝 Summarize
                  </button>

                  <button
                    onClick={() => generateQuiz(note)}
                    disabled={aiLoading}
                  >
                    🧠 Generate Quiz
                  </button>

                  <button
                    onClick={() => explainTopic(note)}
                    disabled={aiLoading}
                  >
                    💡 Explain
                  </button>

                </div>

                {/* Delete */}
                <button
                  className="delete-btn"
                  onClick={() => deleteNote(note.$id)}
                >
                  🗑 Delete Note
                </button>

              </div>

            ))}

          </div>

          {filteredNotes.length === 0 && (

            <p className="empty-message">
              No study notes found.
              Add your first study note!
            </p>

          )}

        </section>

      </main>

      <footer className="footer">
        <p>
          AI Study Assistant | Powered by Appwrite and Ollama
        </p>
      </footer>

    </div>
  );
}

export default App;