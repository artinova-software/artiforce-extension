import { z } from "zod";

// Zod 4 probes `new Function` to compile fast parsers. MV3 extension pages and
// the service worker forbid eval (CSP), so the probe would only log a CSP
// violation: run every bundle in jitless mode. Imported first by each entry.
z.config({ jitless: true });
