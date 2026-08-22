import { handleEngineRequest, type EngineRequest } from '@/lib/json/engine';

self.addEventListener('message', (event: MessageEvent<EngineRequest>) => {
  const { response, transfer } = handleEngineRequest(event.data);
  (self as unknown as Worker).postMessage(response, transfer);
});
