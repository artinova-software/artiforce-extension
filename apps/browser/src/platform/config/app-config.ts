import { z } from "zod";

const originSchema = z
  .string()
  .regex(/^(https:\/\/[a-z0-9.-]+|http:\/\/localhost(:\d+)?)$/, "Expected a bare origin");

export const appConfigSchema = z.strictObject({
  /** Origins where the bridge content script answers the web app. */
  artinovaOrigins: z.array(originSchema).min(1),
  /** Opened by « Ouvrir Artinova ». */
  artinovaAppUrl: z.url(),
  helpUrl: z.url(),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

/** The build-time config (DefinePlugin), validated at startup. */
export function loadAppConfig(raw: unknown = __APP_CONFIG__): AppConfig {
  return appConfigSchema.parse(raw);
}
