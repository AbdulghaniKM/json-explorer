import { useClipboard } from './useClipboard';
import { useJsonFile } from './useJsonFile';
import { useKeyboard } from './useKeyboard';
import { useToast } from './useToast';
import { useJsonStore } from '@/stores/json.store';

export const useJsonWorkspace = (options: { shortcuts?: boolean } = {}) => {
  const store = useJsonStore();
  const { copy } = useClipboard();
  const { openFile, download } = useJsonFile();
  const { success, error: toastError } = useToast();

  const open = async () => {
    const loaded = await openFile();
    if (!loaded) return;
    store.replaceSource(loaded.text);
    success(`Loaded ${loaded.name}`);
  };

  const save = () => {
    if (!store.source.trim()) return;
    download(store.source, 'data.json');
  };

  const copyAll = async () => {
    if (!store.source.trim()) return;
    await copy(store.source, true);
  };

  const beautify = () => {
    if (!store.beautify()) toastError('Fix the syntax error first', { title: 'Invalid JSON' });
  };

  const minify = () => {
    if (!store.minify()) toastError('Fix the syntax error first', { title: 'Invalid JSON' });
  };

  const repair = () => {
    if (store.repair()) success('Repaired and reformatted');
    else toastError('Could not repair this input automatically', { title: 'Still invalid' });
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
        beautify();
        return true;
      },
      'ctrl+m': () => {
        minify();
        return true;
      },
    });
  }

  return { store, open, save, copyAll, beautify, minify, repair, download, copy };
};
