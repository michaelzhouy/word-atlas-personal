import type { Accent } from "../atlas/types";

export type LearningLanguage = "en" | "de";

/** A future German dataset must also have its own dataset ID and answer rules. */
export function speechLocale(language: LearningLanguage, accent: Accent) {
  return language === "de" ? "de-DE" : accent === "us" ? "en-US" : "en-GB";
}
