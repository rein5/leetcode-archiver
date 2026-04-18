/** Maps LeetCode language slugs to file extensions. */
export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  cpp: "cpp",
  java: "java",
  python: "py",
  python3: "py",
  c: "c",
  csharp: "cs",
  javascript: "js",
  typescript: "ts",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  dart: "dart",
  golang: "go",
  ruby: "rb",
  scala: "scala",
  rust: "rs",
  racket: "rkt",
  erlang: "erl",
  elixir: "ex",
  denojs: "ts",
};

export function getExtension(langSlug: string): string {
  return LANGUAGE_EXTENSIONS[langSlug.toLowerCase()] ?? "txt";
}
