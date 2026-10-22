import type { LogService } from "./log.service";

/** The only console writer. Debug output is kept to development builds. */
export class ConsoleLogService implements LogService {
  constructor(
    private readonly isDev: boolean,
    private readonly prefix = "[Artiforce]",
  ) {}

  debug(message: string, ...details: unknown[]): void {
    if (this.isDev) {
      console.debug(this.prefix, message, ...details);
    }
  }

  info(message: string, ...details: unknown[]): void {
    console.info(this.prefix, message, ...details);
  }

  warn(message: string, ...details: unknown[]): void {
    console.warn(this.prefix, message, ...details);
  }

  error(message: string, ...details: unknown[]): void {
    console.error(this.prefix, message, ...details);
  }
}
