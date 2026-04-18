import browser from "webextension-polyfill";
import { getSettings, saveLastSubmission } from "../shared/storage";
import { putFile } from "../shared/github";
import { getExtension } from "../shared/languages";
import type { Submission, ContentMessage } from "../shared/types";

// ---------------------------------------------------------------------------
// GraphQL response interception via filterResponseData (Firefox MV2 only)
// ---------------------------------------------------------------------------

const LEETCODE_GRAPHQL = "*://leetcode.com/graphql*";

browser.webRequest.onBeforeRequest.addListener(
  interceptGraphQL,
  { urls: [LEETCODE_GRAPHQL], types: ["xmlhttprequest", "other"] },
  ["blocking"]
);

function interceptGraphQL(
  details: browser.WebRequest.OnBeforeRequestDetailsType
): browser.WebRequest.BlockingResponse {
  const filter = browser.webRequest.filterResponseData(details.requestId);
  const decoder = new TextDecoder("utf-8");
  const chunks: ArrayBuffer[] = [];

  filter.ondata = (event: { data: ArrayBuffer }) => {
    chunks.push(event.data);
    filter.write(event.data);
  };

  filter.onstop = () => {
    filter.disconnect();
    const full = chunks.reduce((acc, chunk) => {
      const tmp = new Uint8Array(acc.byteLength + chunk.byteLength);
      tmp.set(new Uint8Array(acc), 0);
      tmp.set(new Uint8Array(chunk), acc.byteLength);
      return tmp.buffer;
    }, new ArrayBuffer(0));

    const text = decoder.decode(full);
    try {
      const json = JSON.parse(text);
      handleGraphQLResponse(json, details.tabId);
    } catch {
      // Not JSON or not relevant — ignore
    }
  };

  return {};
}

// ---------------------------------------------------------------------------
// Parse GraphQL response and extract accepted submission
// ---------------------------------------------------------------------------

interface SubmissionDetails {
  id?: string;
  statusCode?: number; // 10 = Accepted
  lang?: { name?: string; verboseName?: string };
  code?: string;
  runtime?: number;  // ms
  memory?: number;   // MB
  question?: {
    questionId?: string;        // numeric string, e.g. "1"
    titleSlug?: string;         // e.g. "two-sum"
    difficulty?: string;        // may not be present in this query
  };
}

interface GraphQLResponse {
  data?: {
    submissionDetails?: SubmissionDetails;
  };
}

function handleGraphQLResponse(json: unknown, tabId: number) {
  // LeetCode can return an array of responses (batched queries)
  const responses: GraphQLResponse[] = Array.isArray(json)
    ? json
    : [json as GraphQLResponse];

  for (const response of responses) {
    const details = response?.data?.submissionDetails;
    if (!details) continue;

    // statusCode 10 = Accepted in LeetCode's system
    if (details.statusCode !== 10) continue;

    const question = details.question;
    if (!question?.titleSlug || !question?.questionId) continue;

    const submission: Submission = {
      submissionId: String(details.id ?? ""),
      problemSlug: question.titleSlug,
      problemNumber: parseInt(question.questionId, 10),
      problemTitle: titleFromSlug(question.titleSlug),
      difficulty: normalizeDifficulty(question.difficulty),
      language: details.lang?.name ?? "unknown",
      code: details.code ?? "",
      runtimeMs: details.runtime ?? null,
      memoryBytes: details.memory ?? null,
    };

    handleAcceptedSubmission(submission, tabId);
    break; // Only process the first accepted submission found
  }
}

/** "two-sum" → "Two Sum" */
function titleFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeDifficulty(
  d: string | undefined
): Submission["difficulty"] {
  if (d === "Easy") return "Easy";
  if (d === "Medium") return "Medium";
  if (d === "Hard") return "Hard";
  return undefined;
}

// ---------------------------------------------------------------------------
// Build file paths and commit to GitHub
// ---------------------------------------------------------------------------

async function handleAcceptedSubmission(
  submission: Submission,
  tabId: number
) {
  setBadge("uploading");
  notifyTab(tabId, { type: "UPLOAD_STATUS", status: "uploading" });

  try {
    const settings = await getSettings();
    if (!settings.githubToken || !settings.repoFullName) {
      throw new Error(
        "GitHub token or repository not configured. Open the extension popup to set them up."
      );
    }

    await commitSubmission(settings.githubToken, settings.repoFullName, submission);

    setBadge("success");
    notifyTab(tabId, { type: "UPLOAD_STATUS", status: "success" });
    await saveLastSubmission({
      status: "success",
      problemTitle: submission.problemTitle,
      problemNumber: submission.problemNumber,
      timestamp: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[LeetCode Archiver] Upload failed:", message);
    setBadge("error");
    notifyTab(tabId, { type: "UPLOAD_STATUS", status: "error", error: message });
    await saveLastSubmission({
      status: "error",
      problemTitle: submission.problemTitle,
      problemNumber: submission.problemNumber,
      timestamp: Date.now(),
      error: message,
    });
  }
}

async function commitSubmission(
  token: string,
  repo: string,
  s: Submission
): Promise<void> {
  const paddedNumber = String(s.problemNumber).padStart(4, "0");
  const safeSlug = s.problemSlug.replace(/[^a-z0-9-]/g, "");
  const dirName = `${paddedNumber}-${safeSlug}`;
  const ext = getExtension(s.language);
  const commitMsg = `feat: solve ${paddedNumber}. ${s.problemTitle}`;

  await putFile(token, repo, `${dirName}/solution.${ext}`, s.code, commitMsg);
  await putFile(token, repo, `${dirName}/description.md`, buildDescription(s), commitMsg);
}

function buildDescription(s: Submission): string {
  const paddedNumber = String(s.problemNumber).padStart(4, "0");
  const url = `https://leetcode.com/problems/${s.problemSlug}/`;
  const lines = [
    `# ${paddedNumber}. ${s.problemTitle}`,
    "",
    `See: ${url}`,
  ];
  lines.push("");
  if (s.difficulty) lines.push(`**Difficulty:** ${s.difficulty}`);
  if (s.runtimeMs !== null) lines.push(`**Runtime:** ${s.runtimeMs} ms`);
  if (s.memoryBytes !== null) lines.push(`**Memory:** ${(s.memoryBytes / 1_000_000).toFixed(2)} MB`);
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Extension badge indicator
// ---------------------------------------------------------------------------

let badgeTimer: ReturnType<typeof setTimeout> | null = null;
let spinnerTimer: ReturnType<typeof setInterval> | null = null;
let spinnerFrame = 0;
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function setBadge(status: "uploading" | "success" | "error") {
  if (badgeTimer) { clearTimeout(badgeTimer); badgeTimer = null; }
  if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null; }

  if (status === "uploading") {
    browser.browserAction.setBadgeBackgroundColor({ color: "#4A90E2" });
    spinnerFrame = 0;
    spinnerTimer = setInterval(() => {
      browser.browserAction.setBadgeText({ text: SPINNER[spinnerFrame % SPINNER.length] });
      spinnerFrame++;
    }, 100);
    return;
  }

  const color = status === "success" ? "#5CB85C" : "#D9534F";
  const text  = status === "success" ? "✓" : "✗";
  browser.browserAction.setBadgeBackgroundColor({ color });
  browser.browserAction.setBadgeText({ text });
  badgeTimer = setTimeout(() => browser.browserAction.setBadgeText({ text: "" }), 4000);
}

// ---------------------------------------------------------------------------
// Notify the content script in the given tab
// ---------------------------------------------------------------------------

function notifyTab(tabId: number, message: ContentMessage) {
  if (tabId < 0) return;
  browser.tabs.sendMessage(tabId, message).catch(() => {
    // Tab may have been closed or content script not ready — ignore
  });
}
