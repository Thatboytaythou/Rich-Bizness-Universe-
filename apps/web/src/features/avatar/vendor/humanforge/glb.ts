// Minimal GLB geometry reader (no DOM, no TextDecoder, no GLTFLoader) so the human
// runtime works the same in browsers and React Native. Reads the first mesh primitive:
// attributes (incl. custom _MH/_REFS/... and KHR_mesh_quantization types) and indices.

export interface GlbAttribute {
  array: Float32Array | Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array;
  itemSize: number;
  normalized: boolean;
}
export interface GlbPrimitive {
  attributes: Record<string, GlbAttribute>;
  index: Uint16Array | Uint32Array;
}

const TYPES: Record<number, any> = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
const SIZES: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function ascii(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
}

export function readGlb(buffer: ArrayBuffer): GlbPrimitive {
  if(buffer.byteLength<28)throw Error('Truncated GLB');const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = dv.getUint32(12,true);if(dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==buffer.byteLength||dv.getUint32(16,true)!==0x4e4f534a||jsonLen>buffer.byteLength-28)throw Error('Invalid GLB header');
  const json = JSON.parse(decodeURIComponent(escape(ascii(new Uint8Array(buffer, 20, jsonLen)))));
  const binStart=20+jsonLen+8,binSize=dv.getUint32(binStart-8,true);if(dv.getUint32(binStart-4,true)!==0x004e4942||binSize>buffer.byteLength-binStart)throw Error('Invalid GLB binary chunk');
  const read = (i: number): GlbAttribute => {
    const acc = json.accessors[i];
    if(!acc||acc.sparse)throw Error('Unsupported GLB accessor');const view=json.bufferViews[acc.bufferView];if(!view||view.buffer!==0)throw Error('Invalid GLB buffer view');
    const T = TYPES[acc.componentType];
    const size = SIZES[acc.type];
    if(!T||!size||!Number.isSafeInteger(acc.count)||acc.count<1||acc.count>1000000)throw Error('Invalid GLB accessor size');
    const start = binStart + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const stride=view.byteStride??size*T.BYTES_PER_ELEMENT;const end=start+(acc.count-1)*stride+size*T.BYTES_PER_ELEMENT;const viewStart=binStart+(view.byteOffset??0);if(!Number.isSafeInteger(start)||!Number.isSafeInteger(stride)||!Number.isSafeInteger(view.byteLength)||start<viewStart||viewStart<binStart||stride<size*T.BYTES_PER_ELEMENT||end>viewStart+view.byteLength||end>binStart+binSize)throw Error('GLB accessor out of bounds');const out=new T(acc.count*size);
    if (stride === size * T.BYTES_PER_ELEMENT && start % T.BYTES_PER_ELEMENT === 0) {
      out.set(new T(buffer, start, acc.count * size));
    } else {
      // padded / interleaved: copy element by element
      const getter = ({ 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' } as any)[acc.componentType];
      for (let e = 0; e < acc.count; e++) for (let k = 0; k < size; k++) {
        out[e * size + k] = (dv as any)[getter](start + e * stride + k * T.BYTES_PER_ELEMENT, true);
      }
    }
    return { array: out, itemSize: size, normalized: !!acc.normalized };
  };
  const prim=json.meshes?.[0]?.primitives?.[0];if(!prim||!prim.attributes||!Number.isInteger(prim.indices)||(prim.mode!==undefined&&prim.mode!==4))throw Error('Invalid GLB primitive');
  const attributes: Record<string, GlbAttribute> = {};
  for (const [name, idx] of Object.entries(prim.attributes)) attributes[name] = read(idx as number);
  const raw=read(prim.indices);if(raw.itemSize!==1||raw.array.length%3||!(raw.array instanceof Uint16Array||raw.array instanceof Uint32Array||raw.array instanceof Uint8Array))throw Error('Invalid GLB triangle indices');const index=raw.array instanceof Uint8Array?Uint16Array.from(raw.array):raw.array;
  return { attributes, index };
}

/** Convert a (possibly normalized integer) attribute to float values. */
export function toFloat(a: GlbAttribute): Float32Array {
  if (a.array instanceof Float32Array) return a.array;
  const out = new Float32Array(a.array.length);
  const max = a.normalized
    ? a.array instanceof Uint8Array ? 255 : a.array instanceof Uint16Array ? 65535 : a.array instanceof Int8Array ? 127 : a.array instanceof Int16Array ? 32767 : 1
    : 1;
  for (let i = 0; i < out.length; i++) out[i] = a.normalized && max !== 1 ? Math.max(-1, a.array[i]! / max) : a.array[i]!;
  return out;
}
