import browser from "webextension-polyfill";
import type { Settings } from "./types";

export async function getSettings(): Promise<Partial<Settings>> {
  const result = await browser.storage.local.get(["githubToken", "repoFullName"]);
  return result as Partial<Settings>;
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await browser.storage.local.set(settings);
}

export async function clearSettings(): Promise<void> {
  await browser.storage.local.remove(["githubToken", "repoFullName"]);
}
