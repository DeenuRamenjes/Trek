/**
 * @office-kit/xlsx builds `new TextDecoder('latin1')` at module load. Expo's
 * winter TextDecoder (and Hermes) accept utf-8 only and throw RangeError,
 * which would crash the import. This wraps the global TextDecoder so single
 * byte labels decode in JS and everything else is delegated. Installed only
 * when the probe fails. Import this module BEFORE any @office-kit/xlsx import.
 */
const SINGLE_BYTE = new Set(['latin1', 'iso-8859-1', 'l1', 'ascii', 'us-ascii', 'windows-1252', 'cp1252']);

type DecoderCtor = new (label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean }) => {
  decode(input?: ArrayBuffer | ArrayBufferView, options?: { stream?: boolean }): string;
  readonly encoding: string;
};

export function installTextCodec(): void {
  const g = globalThis as unknown as { TextDecoder?: DecoderCtor };
  const Found = g.TextDecoder;
  if (!Found) return;
  const Original: DecoderCtor = Found;
  try {
    new Original('latin1');
    return;
  } catch {
    // fall through and wrap
  }
  class PatchedTextDecoder {
    private readonly inner: InstanceType<DecoderCtor> | null;
    readonly encoding: string;
    constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean }) {
      const l = (label ?? 'utf-8').trim().toLowerCase();
      if (SINGLE_BYTE.has(l)) {
        this.inner = null;
        this.encoding = 'windows-1252';
      } else {
        this.inner = new Original(label, options);
        this.encoding = this.inner.encoding;
      }
    }
    decode(input?: ArrayBuffer | ArrayBufferView, options?: { stream?: boolean }): string {
      if (this.inner) return this.inner.decode(input, options);
      if (input === undefined) return '';
      const bytes =
        input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      let out = '';
      for (let i = 0; i < bytes.length; i += 4096) {
        out += String.fromCharCode(...bytes.subarray(i, i + 4096));
      }
      return out;
    }
  }
  g.TextDecoder = PatchedTextDecoder as unknown as DecoderCtor;
}

installTextCodec();
