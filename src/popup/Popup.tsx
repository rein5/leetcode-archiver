import { useState, useEffect } from "react";
import { getSettings, saveSettings, clearSettings } from "../shared/storage";
import { verifyToken } from "../shared/github";

type SavedState = "idle" | "saving" | "saved" | "error";

export function Popup() {
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [saveState, setSaveState] = useState<SavedState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [verifiedUser, setVerifiedUser] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      if (s.githubToken) setToken(s.githubToken);
      if (s.repoFullName) setRepo(s.repoFullName);
    });
  }, []);

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg("");
    try {
      const user = await verifyToken(token);
      await saveSettings({ githubToken: token, repoFullName: repo });
      setVerifiedUser(user.login);
      setSaveState("saved");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setSaveState("error");
    }
  }

  async function handleClear() {
    await clearSettings();
    setToken("");
    setRepo("");
    setVerifiedUser(null);
    setSaveState("idle");
  }

  const isValid = token.trim().length > 0 && /^[\w-]+\/[\w.-]+$/.test(repo.trim());

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>LeetCode Archiver</h1>

      <p style={styles.hint}>
        Create a{" "}
        <strong>fine-grained personal access token</strong> on GitHub with
        &ldquo;Contents: Read and write&rdquo; permission scoped to a single
        private repo.
      </p>

      <label style={styles.label}>GitHub token</label>
      <input
        style={styles.input}
        type="password"
        placeholder="github_pat_…"
        value={token}
        onChange={(e) => { setToken(e.target.value); setSaveState("idle"); }}
        spellCheck={false}
      />

      <label style={styles.label}>Repository (owner/repo)</label>
      <input
        style={styles.input}
        type="text"
        placeholder="you/leetcode-solutions"
        value={repo}
        onChange={(e) => { setRepo(e.target.value); setSaveState("idle"); }}
        spellCheck={false}
      />

      {saveState === "error" && (
        <p style={styles.error}>{errorMsg}</p>
      )}

      {saveState === "saved" && verifiedUser && (
        <p style={styles.success}>Connected as {verifiedUser} ✓</p>
      )}

      <div style={styles.row}>
        <button
          style={{ ...styles.button, ...styles.primary, opacity: isValid ? 1 : 0.5 }}
          disabled={!isValid || saveState === "saving"}
          onClick={handleSave}
        >
          {saveState === "saving" ? "Verifying…" : "Save"}
        </button>
        <button style={{ ...styles.button, ...styles.secondary }} onClick={handleClear}>
          Clear
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 300,
    padding: "20px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
    color: "#fff",
  },
  hint: {
    fontSize: 12,
    color: "#aaa",
    lineHeight: 1.5,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#ccc",
    marginTop: 4,
  },
  input: {
    padding: "7px 10px",
    borderRadius: 5,
    border: "1px solid #444",
    background: "#0f0f23",
    color: "#e0e0e0",
    fontSize: 13,
    outline: "none",
    width: "100%",
  },
  row: {
    display: "flex",
    gap: 8,
    marginTop: 6,
  },
  button: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 5,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  primary: {
    background: "#ffa116",
    color: "#1a1a2e",
  },
  secondary: {
    background: "#2a2a4a",
    color: "#aaa",
  },
  error: {
    fontSize: 12,
    color: "#ff6b6b",
  },
  success: {
    fontSize: 12,
    color: "#5cb85c",
  },
};
