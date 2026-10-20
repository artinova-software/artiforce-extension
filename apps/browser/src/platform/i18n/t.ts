import type messages from "../../_locales/fr/messages.json";
import { BrowserApi } from "../browser/browser-api";

export type MessageKey = keyof typeof messages;

/** A message from `_locales/fr/messages.json`, typed by key. French only in v1. */
export function t(key: MessageKey, ...substitutions: (string | number)[]): string {
  const text = BrowserApi.getMessage(key, substitutions.map(String));
  return text === "" ? key : text;
}
