import { useSyncExternalStore } from "react";

export const ROUTES = ["/", "/suppliers", "/help"] as const;
export type Route = (typeof ROUTES)[number];

function current(): Route {
  const path = window.location.hash.replace(/^#/, "") || "/";
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : "/";
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

/** Hash routes, as in Bitwarden's popup: `#/`, `#/suppliers`, `#/help`. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current, () => "/");
}

export function navigate(route: Route): void {
  window.location.hash = route;
}
