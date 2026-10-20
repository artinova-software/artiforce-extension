/** Serializes async sections: each `run` starts once the previous one settled. */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(section: () => Promise<T>): Promise<T> {
    const result = this.tail.then(section, section);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
