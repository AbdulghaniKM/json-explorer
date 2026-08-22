import {
  engineFailure,
  failureMessageFor,
  handleEngineRequest,
  type EngineCall,
  type EngineRequest,
  type EngineResponse,
} from '@/lib/json/engine';

type Pending = { request: EngineRequest; settle: (response: EngineResponse) => void };

let worker: Worker | null = null;
let workerFailed = false;
let sequence = 0;
const pending = new Map<number, Pending>();

const WORKER_UNAVAILABLE = 'The background worker stopped, so this ran on the main thread.';

/**
 * Settle every in-flight request instead of leaving their promises hanging - an unsettled
 * promise here permanently latches the caller's busy flag and blocks all later operations.
 */
const failAllPending = (message: string) => {
  const entries = [...pending.values()];
  pending.clear();
  for (const entry of entries) entry.settle(engineFailure(entry.request, message));
};

const teardown = (message: string) => {
  const instance = worker;
  worker = null;
  failAllPending(message);
  try {
    instance?.terminate();
  } catch {
    /* the worker is already gone */
  }
};

const ensureWorker = (): Worker | null => {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (worker) return worker;

  try {
    worker = new Worker(new URL('../workers/json.worker.ts', import.meta.url), { type: 'module' });

    worker.addEventListener('message', (event: MessageEvent<EngineResponse>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      entry.settle(event.data);
    });

    // An `error` here means the worker script itself failed to load or parse - job-level
    // throws are already caught inside the worker. That is not recoverable by retrying, so
    // fall back to the main thread from now on, but never leave callers hanging.
    worker.addEventListener('error', () => {
      workerFailed = true;
      teardown(WORKER_UNAVAILABLE);
    });

    // A response that cannot be deserialized would otherwise never resolve.
    worker.addEventListener('messageerror', () => {
      teardown('The result was too large to send back from the background worker.');
    });

    return worker;
  } catch {
    workerFailed = true;
    worker = null;
    return null;
  }
};

const runOnMainThread = <T extends EngineResponse>(message: EngineRequest): Promise<T> => {
  // handleEngineRequest is guarded, but keep the call inside the promise so that even a
  // synchronous throw surfaces as a rejected promise rather than escaping `runOffThread`.
  return new Promise<T>((resolve) => {
    try {
      resolve(handleEngineRequest(message).response as T);
    } catch (error) {
      resolve(engineFailure(message, failureMessageFor(error)) as T);
    }
  });
};

export const runOffThread = <T extends EngineResponse>(request: EngineCall): Promise<T> => {
  const id = ++sequence;
  const message = { ...request, id } as EngineRequest;
  const instance = ensureWorker();

  if (!instance) return runOnMainThread<T>(message);

  return new Promise<T>((resolve) => {
    pending.set(id, { request: message, settle: (response) => resolve(response as T) });
    try {
      instance.postMessage(message);
    } catch (error) {
      // The request could not be cloned - resolve here rather than waiting for a reply
      // that will never come.
      pending.delete(id);
      resolve(engineFailure(message, failureMessageFor(error)) as T);
    }
  });
};

export const useJsonEngine = () => ({ run: runOffThread });
