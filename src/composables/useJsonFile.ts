import { useToast } from './useToast';

export interface LoadedFile {
  name: string;
  text: string;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const useJsonFile = () => {
  const { error: toastError } = useToast();

  const readFile = async (file: File): Promise<LoadedFile | null> => {
    if (file.size > MAX_FILE_BYTES) {
      toastError(`${file.name} is larger than 15 MB`, { title: 'File too large' });
      return null;
    }
    try {
      const text = await file.text();
      return { name: file.name, text };
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
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        resolve(file ? await readFile(file) : null);
      });
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
