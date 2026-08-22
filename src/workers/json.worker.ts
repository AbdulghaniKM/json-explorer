import {
  engineFailure,
  failureMessageFor,
  handleEngineRequest,
  type EngineRequest,
} from '@/lib/json/engine';

const worker = self as unknown as Worker;

self.addEventListener('message', (event: MessageEvent<EngineRequest>) => {
  const request = event.data;

  try {
    const { response, transfer } = handleEngineRequest(request);
    worker.postMessage(response, transfer);
  } catch (error) {
    // handleEngineRequest is itself guarded, so reaching here means postMessage failed -
    // usually a structured-clone error on the response. Reply anyway: a silent worker
    // leaves the caller awaiting a promise that can never settle.
    try {
      worker.postMessage(engineFailure(request, failureMessageFor(error)));
    } catch {
      worker.postMessage({
        id: request?.id ?? -1,
        kind: request?.kind ?? 'validate',
        ok: false,
        message: 'Something went wrong processing this document.',
      });
    }
  }
});
