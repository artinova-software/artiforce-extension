import type { z } from "zod";

/** `disk` is `storage.local` (survives restarts); `memory` is `storage.session`. */
export type StorageLocation = "disk" | "memory";

export class StateDefinition {
  constructor(
    readonly name: string,
    readonly location: StorageLocation,
  ) {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
      throw new Error(`Invalid state name "${name}"`);
    }
  }
}

export type KeyDefinitionOptions<T> = {
  /** Every read goes through it; an invalid value falls back to `defaultValue`. */
  schema: z.ZodType<T>;
  defaultValue: T;
};

export class KeyDefinition<T> {
  constructor(
    readonly state: StateDefinition,
    readonly key: string,
    readonly options: KeyDefinitionOptions<T>,
  ) {}

  /** The storage key: `global_<state>_<key>`. */
  get storageKey(): string {
    return `global_${this.state.name}_${this.key}`;
  }
}
