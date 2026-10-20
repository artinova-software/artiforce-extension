import { BrowserApi } from "../browser/browser-api";
import {
  CHANNEL,
  type CommandDefinition,
  CommandError,
  MessagingErrorCode,
  responseEnvelopeSchema,
} from "./command";

/**
 * Sends a command to the background and returns its validated result. Throws a
 * CommandError (`EXTENSION_RELOADED` when this context was orphaned by an update).
 */
export async function sendCommand<Name extends string, Request, Response>(
  command: CommandDefinition<Name, Request, Response>,
  request: Request,
): Promise<Response> {
  if (!BrowserApi.contextValid()) {
    throw new CommandError(MessagingErrorCode.EXTENSION_RELOADED);
  }
  let raw: unknown;
  try {
    raw = await BrowserApi.sendMessage({
      channel: CHANNEL,
      command: command.name,
      payload: request,
    });
  } catch (error) {
    const reloaded = !BrowserApi.contextValid() || /context invalidated/i.test(String(error));
    throw new CommandError(
      reloaded ? MessagingErrorCode.EXTENSION_RELOADED : MessagingErrorCode.INTERNAL,
      String(error),
    );
  }
  const envelope = responseEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    throw new CommandError(MessagingErrorCode.INTERNAL, "Malformed response");
  }
  if (!envelope.data.ok) {
    throw new CommandError(envelope.data.error.code, envelope.data.error.message);
  }
  const result = command.response.safeParse(envelope.data.result);
  if (!result.success) {
    throw new CommandError(MessagingErrorCode.INTERNAL, "Unexpected response");
  }
  return result.data;
}
