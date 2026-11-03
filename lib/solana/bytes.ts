/**
 * Little-endian 64-bit helpers that work with any Buffer polyfill. Browser
 * bundles (Turbopack) ship a Buffer without the BigInt methods, so these go
 * through DataView instead of Buffer#writeBigUInt64LE / readBigUInt64LE.
 */
export function u64le(n: bigint | number): Buffer {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setBigUint64(0, BigInt(n), true)
  return Buffer.from(out)
}

export function i64le(n: bigint | number): Buffer {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setBigInt64(0, BigInt(n), true)
  return Buffer.from(out)
}

function view(buf: Uint8Array) {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
}

export function readU64(buf: Uint8Array, offset: number): bigint {
  return view(buf).getBigUint64(offset, true)
}

export function readI64(buf: Uint8Array, offset: number): bigint {
  return view(buf).getBigInt64(offset, true)
}
