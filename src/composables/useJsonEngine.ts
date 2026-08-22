import {
  handleEngineRequest,
  type EngineCall,
  type EngineRequest,
  type EngineResponse,
} from '@/lib/json/engine';

type Pending = (response: EngineResponse) => void;

let worker: Worker | null = null;
let workerFailed = false;
let sequence = 0;
const pending = new Map<number, Pending>();

const ensureWorker = (): Worker | null => {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (worker) return worker;

  try {
    worker = new Worker(new URL('../workers/json.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<EngineResponse>) => {
      const resolve = pending.get(event.data.id);
      if (!resolve) return;
      pending.delete(event.data.id);
      resolve(event.data);
    });
    worker.addEventListener('error', () => {
      workerFailed = true;
      worker = null;
    });
    return worker;
  } catch {
    workerFailed = true;
    worker = null;
    return null;
  }
};

export const runOffThread = <T extends EngineResponse>(request: EngineCall): Promise<T> => {
  const id = ++sequence;
  const message = { ...request, id } as EngineRequest;
  const instance = ensureWorker();

  if (!instance) {
    return Promise.resolve(handleEngineRequest(message).response as T);
  }

  return new Promise<T>((resolve) => {
    pending.set(id, (response) => resolve(response as T));
    instance.postMessage(message);
  });
};

export const useJsonEngine = () => ({ run: runOffThread });
