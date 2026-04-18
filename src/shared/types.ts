export interface Settings {
  githubToken: string;
  repoFullName: string; // "owner/repo"
}

export interface Submission {
  problemSlug: string;
  problemNumber: number;
  problemTitle: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  language: string;
  code: string;
  runtimeMs: number | null;
  memoryBytes: number | null;
}

export type UploadStatus = "uploading" | "success" | "error";

export interface ContentMessage {
  type: "UPLOAD_STATUS";
  status: UploadStatus;
  error?: string;
}

export interface LastSubmission {
  status: "success" | "error";
  problemTitle: string;
  problemNumber: number;
  timestamp: number; // Date.now()
  error?: string;
}
