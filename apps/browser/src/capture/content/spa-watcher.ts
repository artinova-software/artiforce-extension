export type SpaWatcherOptions = {
  /** Called (debounced) when the URL changed or the page mutated. */
  onChange(urlChanged: boolean): void;
  debounceMs?: number;
};

/**
 * Watches single-page apps: a MutationObserver, debounced, that reports
 * whether the URL changed since the last report.
 */
export class SpaWatcher {
  private observer: MutationObserver | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastUrl: string;

  constructor(
    private readonly window: Window,
    private readonly options: SpaWatcherOptions,
  ) {
    this.lastUrl = window.location.href;
  }

  start(): void {
    const document = this.window.document;
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
    this.window.addEventListener("popstate", this.schedule);
  }

  stop(): void {
    this.observer?.disconnect();
    this.window.removeEventListener("popstate", this.schedule);
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
  }

  private readonly schedule = (): void => {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const url = this.window.location.href;
      const urlChanged = url !== this.lastUrl;
      this.lastUrl = url;
      this.options.onChange(urlChanged);
    }, this.options.debounceMs ?? 300);
  };
}
