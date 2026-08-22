import { useClipboard } from './useClipboard';
import { useJsonFile } from './useJsonFile';
import { useKeyboard } from './useKeyboard';
import { useToast } from './useToast';
import { useJsonStore } from '@/stores/json.store';
import type { TransformOp } from '@/lib/json';

export const CLIPBOARD_LIMIT = 4 * 1024 * 1024;

export const useJsonWorkspace = (options: { shortcuts?: boolean } = {}) => {
  const store = useJsonStore();
  const { copy } = useClipboard();
  const { openFile, download } = useJsonFile();
  const { success, error: toastError, info } = useToast();

  const open = async () => {
    const loaded = await openFile();
    if (!loaded) return;
    store.replaceSource(loaded.text);
    success(`Loaded ${loaded.name}`, {
      title: `${(loaded.text.length / 1024 / 1024).toFixed(1)} MB`,
    });
  };

  const save = () => {
    if (!store.source.trim()) return;
    download(store.source, 'data.json');
  };

  const copyAll = async () => {
    if (!store.source.trim()) return;
    if (store.source.length > CLIPBOARD_LIMIT) {
      toastError('This document is too large for the clipboard — download it instead', {
        title: 'Not copied',
      });
      return;
    }
    await copy(store.source, true);
  };

  const run = async (op: TransformOp) => {
    const result = await store.run(op);
    if (!result.ok) toastError(result.message ?? 'That did not work', { title: 'No changes made' });
    else if (result.message) success(result.message);
  };

  const beautify = () => run('beautify');
  const minify = () => run('minify');
  const repair = () => run('repair');

  const generate = async (records: number) => {
    info(`Generating ${records.toLocaleString('en-US')} records…`);
    await store.generate(records);
    success(`Generated ${(store.source.length / 1024 / 1024).toFixed(1)} MB of JSON`);
  };

  if (options.shortcuts !== false) {
    useKeyboard({
      'ctrl+o': () => {
        void open();
        return true;
      },
      'ctrl+s': () => {
        save();
        return true;
      },
      'ctrl+b': () => {
        void beautify();
        return true;
      },
      'ctrl+m': () => {
        void minify();
        return true;
      },
    });
  }

  return { store, open, save, copyAll, run, beautify, minify, repair, generate, download, copy };
};
