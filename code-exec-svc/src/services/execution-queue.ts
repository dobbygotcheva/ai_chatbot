interface QueueTask {
  execute: () => Promise<unknown>;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

export class ExecutionQueue {
  private maxConcurrent = 10;
  private current = 0;
  private queue: QueueTask[] = [];

  async add<T>(execute: () => Promise<T>): Promise<T> {
    if (this.current < this.maxConcurrent) {
      this.current++;
      try {
        return await execute();
      } finally {
        this.current--;
        this.processQueue();
      }
    } else {
      return new Promise((resolve, reject) => {
        this.queue.push({
          execute: execute as () => Promise<unknown>,
          resolve: resolve as (result: unknown) => void,
          reject,
        });
      });
    }
  }

  private processQueue() {
    if (this.queue.length > 0 && this.current < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) {
        this.add(next.execute).then(next.resolve).catch(next.reject);
      }
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

export const executionQueue = new ExecutionQueue();
