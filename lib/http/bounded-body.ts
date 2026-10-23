export class BodyError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function readBoundedText(request: Request, limit = 32 * 1024): Promise<string> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > limit) throw new BodyError(413, "Request body is too large.");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        // A cloned request is a tee. Awaiting cancellation waits for its other
        // branch too, which may never be consumed after this rejection.
        void reader.cancel().catch(() => {});
        throw new BodyError(413, "Request body is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new BodyError(400, "Invalid request encoding."); }
}

export async function readJsonBody(request: Request) {
  const body = await readBoundedText(request);
  try { return JSON.parse(body) as unknown; }
  catch { throw new BodyError(400, "Request body must be JSON."); }
}
