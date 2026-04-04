import browser from "webextension-polyfill";
import { getSettings } from "../shared/storage";
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
  const encoder = new TextEncoder();
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

interface SubmissionDetailsData {
  submissionDetails?: {
    id?: string;
    statusCode?: number; // 10 = Accepted
    lang?: { name?: string; verboseName?: string };
    code?: string;
    runtimeMs?: number;
    memoryMb?: number;
    question?: {
      questionFrontendId?: string;
      title?: string;
      titleSlug?: string;
      difficulty?: string;
    };
  };
}

function handleGraphQLResponse(json: unknown, tabId: number) {
  // LeetCode can return an array of responses (batched queries)
  const responses: SubmissionDetailsData[] = Array.isArray(json)
    ? json
    : [json as SubmissionDetailsData];

  for (const response of responses) {
    const details = response?.submissionDetails;
    if (!details) continue;

    // statusCode 10 = Accepted in LeetCode's system
    if (details.statusCode !== 10) continue;

    const question = details.question;
    if (!question?.titleSlug || !question?.questionFrontendId) continue;

    const submission: Submission = {
      submissionId: String(details.id ?? ""),
      problemSlug: question.titleSlug,
      problemNumber: parseInt(question.questionFrontendId, 10),
      problemTitle: question.title ?? question.titleSlug,
      difficulty: normalizeDifficulty(question.difficulty),
      language: details.lang?.name ?? "unknown",
      code: details.code ?? "",
      runtimeMs: details.runtimeMs ?? null,
      memoryMb: details.memoryMb ?? null,
    };

    handleAcceptedSubmission(submission, tabId);
    break; // Only process the first accepted submission found
  }
}

function normalizeDifficulty(
  d: string | undefined
): Submission["difficulty"] {
  if (d === "Medium") return "Medium";
  if (d === "Hard") return "Hard";
  return "Easy";
}

// ---------------------------------------------------------------------------
// Build file paths and commit to GitHub
// ---------------------------------------------------------------------------

async function handleAcceptedSubmission(
  submission: Submission,
  tabId: number
) {
  notifyTab(tabId, { type: "UPLOAD_STATUS", status: "uploading" });

  try {
    const settings = await getSettings();
    if (!settings.githubToken || !settings.repoFullName) {
      throw new Error(
        "GitHub token or repository not configured. Open the extension popup to set them up."
      );
    }

    await commitSubmission(settings.githubToken, settings.repoFullName, submission);
    notifyTab(tabId, { type: "UPLOAD_STATUS", status: "success" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[LeetCode Archiver] Upload failed:", message);
    notifyTab(tabId, { type: "UPLOAD_STATUS", status: "error", error: message });
  }
}

async function commitSubmission(
  token: string,
  repo: string,
  s: Submission
): Promise<void> {
  const paddedNumber = String(s.problemNumber).padStart(4, "0");
  const dirName = `${paddedNumber}-${s.problemSlug}`;
  const ext = getExtension(s.language);
  const fileName = `${dirName}.${ext}`;

  const statsLine = formatStats(s);

  await putFile(
    token,
    repo,
    `${dirName}/${fileName}`,
    s.code,
    `feat(${s.problemSlug}): add ${s.language} solution [${s.difficulty}]${statsLine}`
  );

  const readme = buildReadme(s, statsLine);
  await putFile(
    token,
    repo,
    `${dirName}/README.md`,
    readme,
    `docs(${s.problemSlug}): add problem README`
  );
}

function formatStats(s: Submission): string {
  const parts: string[] = [];
  if (s.runtimeMs !== null) parts.push(`${s.runtimeMs}ms`);
  if (s.memoryMb !== null) parts.push(`${s.memoryMb.toFixed(1)}MB`);
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

function buildReadme(s: Submission, statsLine: string): string {
  const url = `https://leetcode.com/problems/${s.problemSlug}/`;
  return [
    `# ${String(s.problemNumber).padStart(4, "0")}. ${s.problemTitle}`,
    "",
    `**Difficulty:** ${s.difficulty}  `,
    `**Link:** ${url}  `,
    statsLine ? `**Stats:** ${statsLine.replace(" — ", "")}` : "",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
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
