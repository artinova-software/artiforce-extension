import { type RuntimeSender } from "../browser/browser-api";
import type { LogService } from "../logging/log.service";
import {
  type AnyCommand,
  CommandError,
  type CommandDefinition,
  MessagingErrorCode,
  requestEnvelopeSchema,
  type ResponseEnvelope,
  type SenderKind,
} from "./command";

export type HandlerContext = { sender: RuntimeSender; kind: SenderKind };

type Registration = {
  command: AnyCommand;
  handler: (request: unknown, context: HandlerContext) => Promise<unknown>;
};

export type MessageRouterDependencies = {
  classify(sender: RuntimeSender): SenderKind;
  /** Resolves once the background finished bootstrapping. */
  ready: Promise<void>;
  log: LogService;
};

/**
 * The single `runtime.onMessage` listener. For each message: validate the
 * envelope, check the sender kind is allowed for the command, validate the
 * request, wait for `ready`, run the handler, validate and return its result.
 */
export class MessageRouter {
  private readonly registrations = new Map<string, Registration>();

  constructor(private readonly deps: MessageRouterDependencies) {}

  register<Name extends string, Request, Response>(
    command: CommandDefinition<Name, Request, Response>,
    handler: (request: Request, context: HandlerContext) => Promise<Response>,
  ): void {
    if (this.registrations.has(command.name)) {
      throw new Error(`Command ${command.name} is already registered`);
    }
    this.registrations.set(command.name, {
      command: command as AnyCommand,
      handler: handler as Registration["handler"],
    });
  }

  /** The raw listener: answers asynchronously through `sendResponse`. */
  readonly listener = (
    message: unknown,
    sender: RuntimeSender,
    sendResponse: (response: unknown) => void,
  ): boolean | undefined => {
    // Messages for other listeners (none today) are left alone.
    if (!requestEnvelopeSchema.safeParse(message).success) {
      return undefined;
    }
    void this.handle(message, sender).then(sendResponse);
    return true;
  };

  async handle(message: unknown, sender: RuntimeSender): Promise<ResponseEnvelope> {
    const envelope = requestEnvelopeSchema.safeParse(message);
    if (!envelope.success) {
      return failure(MessagingErrorCode.INVALID_REQUEST, "Malformed envelope");
    }
    const registration = this.registrations.get(envelope.data.command);
    if (registration === undefined) {
      return failure(MessagingErrorCode.UNKNOWN_COMMAND, envelope.data.command);
    }
    const kind = this.deps.classify(sender);
    if (!registration.command.senders.includes(kind)) {
      this.deps.log.warn(`Refused ${envelope.data.command} from ${kind}`, sender.url);
      return failure(MessagingErrorCode.FORBIDDEN, "Sender not allowed");
    }
    const request = registration.command.request.safeParse(envelope.data.payload);
    if (!request.success) {
      return failure(MessagingErrorCode.INVALID_REQUEST, request.error.issues[0]?.message ?? "");
    }
    try {
      await this.deps.ready;
      const result = await registration.handler(request.data, { sender, kind });
      return { ok: true, result: registration.command.response.parse(result) };
    } catch (error) {
      if (error instanceof CommandError) {
        return failure(error.code, error.message);
      }
      this.deps.log.error(`Command ${envelope.data.command} failed`, error);
      return failure(MessagingErrorCode.INTERNAL, "Internal error");
    }
  }
}

function failure(code: string, message: string): ResponseEnvelope {
  return { ok: false, error: { code, message: message.slice(0, 500) } };
}
