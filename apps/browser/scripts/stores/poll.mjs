// Store APIs answer "in progress" for a while after an upload or a submission:
// poll until a terminal state, or give up after the timeout.
export async function poll(check, { label, intervalMs = 10_000, timeoutMs = 10 * 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result.done) {
      return result.value;
    }
    if (Date.now() + intervalMs > deadline) {
      throw new Error(`${label}: still in progress after ${Math.round(timeoutMs / 1000)} s`);
    }
    console.log(`${label}: in progress, next check in ${Math.round(intervalMs / 1000)} s`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** The response body as JSON when it is JSON, its text otherwise (for error messages). */
export async function readBody(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function expectOk(response, label) {
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}
