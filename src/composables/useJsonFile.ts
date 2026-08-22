import { useToast } from './useToast';

export interface LoadedFile {
  name: string;
  text: string;
}

// Matches the engine's own widest ceiling (DIFF_LIMIT). The explorer, formatter, analyzer
// and type generators all work past the narrower per-tool caps, so refusing to *open* a
// document smaller than those caps would be the tightest limit in the app.
const MAX_FILE_BYTES = 64 * 1024 * 1024;

const formatLimit = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

export const useJsonFile = () => {
  const { error: toastError } = useToast();

  const readFile = async (file: File): Promise<LoadedFile | null> => {
    if (file.size > MAX_FILE_BYTES) {
      toastError(`${file.name} is larger than ${formatLimit(MAX_FILE_BYTES)}`, {
        title: 'File too large',
      });
      return null;
    }
    try {
      const text = await file.text();
      // Excel, PowerShell and .NET exports very often carry a BOM, which is not legal JSON.
      return { name: file.name, text: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text };
    } catch {
      toastError(`Could not read ${file.name}`, { title: 'Read failed' });
      return null;
    }
  };

  const openFile = (
    accept = '.json,.txt,.ndjson,.jsonl,application/json',
  ): Promise<LoadedFile | null> =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;

      let settled = false;
      const finish = async (file: File | undefined) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(file ? await readFile(file) : null);
      };

      input.addEventListener('change', () => void finish(input.files?.[0]));
      // Without this the promise never settles when the picker is dismissed, and both the
      // input and its closure leak on every cancel.
      input.addEventListener('cancel', () => void finish(undefined));

      input.click();
    });

  const fromDrop = async (event: DragEvent): Promise<LoadedFile | null> => {
    const file = event.dataTransfer?.files?.[0];
    return file ? await readFile(file) : null;
  };

  const download = (text: string, filename: string, mime = 'application/json') => {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return { openFile, fromDrop, readFile, download };
};
