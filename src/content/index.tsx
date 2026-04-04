import browser from "webextension-polyfill";
import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import type { ContentMessage, UploadStatus } from "../shared/types";

// ---------------------------------------------------------------------------
// Badge component — mounted in a shadow DOM to isolate styles
// ---------------------------------------------------------------------------

function Badge({ status }: { status: UploadStatus }) {
  const styles: Record<UploadStatus, React.CSSProperties> = {
    uploading: { background: "#f0ad4e", color: "#fff" },
    success: { background: "#5cb85c", color: "#fff" },
    error: { background: "#d9534f", color: "#fff" },
  };

  const labels: Record<UploadStatus, string> = {
    uploading: "⏳ Archiving…",
    success: "✓ Archived",
    error: "✗ Archive failed",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 999999,
        padding: "8px 16px",
        borderRadius: "6px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        fontWeight: 600,
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        transition: "opacity 0.3s",
        ...styles[status],
      }}
    >
      {labels[status]}
    </div>
  );
}

function App() {
  const [status, setStatus] = useState<UploadStatus | null>(null);

  useEffect(() => {
    const listener = (message: ContentMessage) => {
      if (message.type !== "UPLOAD_STATUS") return;
      setStatus(message.status);

      if (message.status === "success" || message.status === "error") {
        setTimeout(() => setStatus(null), 4000);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  if (!status) return null;
  return <Badge status={status} />;
}

// ---------------------------------------------------------------------------
// Mount into a shadow DOM so LeetCode's CSS can't bleed in
// ---------------------------------------------------------------------------

const host = document.createElement("div");
host.id = "leetcode-archiver-root";
document.body.appendChild(host);

const shadow = host.attachShadow({ mode: "open" });
const mountPoint = document.createElement("div");
shadow.appendChild(mountPoint);

createRoot(mountPoint).render(<App />);
