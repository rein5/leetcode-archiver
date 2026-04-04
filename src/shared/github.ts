const API_BASE = "https://api.github.com";

interface GitHubUser {
  login: string;
  name: string | null;
}

interface FileContentsResponse {
  sha: string;
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

/** Returns the SHA of an existing file, or null if it doesn't exist. */
async function getFileSha(
  token: string,
  repo: string,
  path: string
): Promise<string | null> {
  const res = await ghFetch(token, `/repos/${repo}/contents/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get file SHA: ${res.status}`);
  const data: FileContentsResponse = await res.json();
  return data.sha;
}

/** Creates or updates a file in the repository. */
export async function putFile(
  token: string,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<void> {
  const sha = await getFileSha(token, repo, path);
  const body: Record<string, string> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
  };
  if (sha) body.sha = sha;

  const res = await ghFetch(token, `/repos/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed (${res.status}): ${err}`);
  }
}
