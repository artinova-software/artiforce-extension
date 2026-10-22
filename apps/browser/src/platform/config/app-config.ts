import { z } from "zod";

const originSchema = z
  .string()
  .regex(/^(https:\/\/[a-z0-9.-]+|http:\/\/localhost(:\d+)?)$/, "Expected a bare origin");

export const appConfigSchema = z.strictObject({
  /** Origins where the bridge content script answers the web app. */
  artiforceOrigins: z.array(originSchema).min(1),
  /** Opened by « Ouvrir Artiforce ». */
  artiforceAppUrl: z.url(),
  /** Where the web app shows the extension selection (add, sort, delete), relative to the app URL. */
  selectionPath: z.string().regex(/^\/[^/]/),
  helpUrl: z.url(),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

/** « Ouvrir Artiforce »: the Stock page of the web app, with the selection panel open. */
export function selectionUrl(config: AppConfig): string {
  return new URL(config.selectionPath, config.artiforceAppUrl).href;
}

/** The build-time config (DefinePlugin), validated at startup. */
export function loadAppConfig(raw: unknown = __APP_CONFIG__): AppConfig {
  return appConfigSchema.parse(raw);
}
