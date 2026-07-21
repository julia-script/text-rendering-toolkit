interface HarfBuzzModule {
  readonly HEAPU8: Uint8Array
  readonly HEAPU16: Uint16Array
  readonly HEAP32: Int32Array
  readonly HEAPU32: Uint32Array
  readonly HEAPF32: Float32Array
  readonly wasmExports: Record<string, (...args: number[]) => number>
  addFunction(callback: (...args: number[]) => number | void, signature: string): number
  removeFunction(pointer: number): void
  stackAlloc(size: number): number
  stackRestore(pointer: number): void
  stackSave(): number
}

declare function createHarfBuzz(): Promise<HarfBuzzModule>

export default createHarfBuzz
