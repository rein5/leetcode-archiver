import { useState, useEffect } from "react";
import browser from "webextension-polyfill";
import { getSettings, saveSettings, clearSettings, getLastSubmission } from "../shared/storage";
import { verifyToken } from "../shared/github";
import type { LastSubmission } from "../shared/types";

type SavedState = "idle" | "saving" | "saved" | "error";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function Popup() {
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [saveState, setSaveState] = useState<SavedState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [verifiedUser, setVerifiedUser] = useState<string | null>(null);
  const [lastSubmission, setLastSubmission] = useState<LastSubmission | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      if (s.githubToken) setToken(s.githubToken);
      if (s.repoFullName) setRepo(s.repoFullName);
    });
    getLastSubmission().then(setLastSubmission);

    // Live-update if a submission completes while popup is open
    const listener = (changes: Record<string, browser.Storage.StorageChange>) => {
      if (changes.lastSubmission) {
        setLastSubmission(changes.lastSubmission.newValue as LastSubmission);
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
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

      {lastSubmission && (
        <div style={{ ...styles.lastSubmission, borderColor: lastSubmission.status === "success" ? "#5cb85c" : "#d9534f" }}>
          <span style={{ fontSize: 15 }}>{lastSubmission.status === "success" ? "✓" : "✗"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {String(lastSubmission.problemNumber).padStart(4, "0")}. {lastSubmission.problemTitle}
            </div>
            {lastSubmission.error
              ? <div style={{ fontSize: 11, color: "#ff6b6b" }}>{lastSubmission.error}</div>
              : <div style={{ fontSize: 11, color: "#888" }}>{timeAgo(lastSubmission.timestamp)}</div>
            }
          </div>
        </div>
      )}
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
  lastSubmission: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid",
    background: "#0f0f23",
  },
};
