const API_BASE = "https://api.github.com";

function encodeBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

interface GitHubUser {
  login: string;
  name: string | null;
}

interface FileState {
  sha: string;
  content: string; // decoded UTF-8
}

async function ghFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export async function verifyToken(token: string): Promise<GitHubUser> {
  const res = await ghFetch(token, "/user");
  if (!res.ok) throw new Error(`GitHub auth failed: ${res.status}`);
  return res.json();
}

/** Returns existing file state (sha + decoded content), or null if not found. */
async function getFileState(
  token: string,
  repo: string,
  path: string
): Promise<FileState | null> {
  const res = await ghFetch(token, `/repos/${repo}/contents/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get file: ${res.status}`);
  const data: { sha: string; content: string } = await res.json();
  const binary = atob(data.content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return { sha: data.sha, content: new TextDecoder().decode(bytes) };
}

/** Creates or updates a file in the repository. No-ops if content is unchanged. */
export async function putFile(
  token: string,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<void> {
  const existing = await getFileState(token, repo, path);
  if (existing?.content === content) return;

  const body: Record<string, string> = {
    message,
    content: encodeBase64(content),
  };
  if (existing) body.sha = existing.sha;

  const res = await ghFetch(token, `/repos/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed (${res.status}): ${err}`);
  }
}
