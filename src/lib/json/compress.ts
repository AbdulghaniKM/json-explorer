export const gzipSize = async (text: string): Promise<number | null> => {
  if (typeof CompressionStream === 'undefined' || !text) return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const reader = stream.getReader();
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
    }
    return total;
  } catch {
    return null;
  }
};
