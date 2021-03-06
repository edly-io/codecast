
import * as C from 'persistent-c';

const uint = C.builtinTypes['unsigned int'];
const uintPtr = C.pointerType(uint);
const uintPtrPtr = C.pointerType(uintPtr);
const headerSize = 4;

/*
Block properties:
  - ref: reference to the block header
  - next: reference to the header of the next block
  - size: raw block size, including header and data areas
  - free: boolean indicating if block is free (true) or allocated (false)
  - start: address of the first byte of the block's data area
  - end: address of the last byte of the block's data area
*/
const getBlock = function (core, ref) {
  const header = C.readValue(core, ref).toInteger();
  const size = header & ~3;
  if (size === 0) {
    return;
  }
  const free = 0 !== (header & 1);
  const start = ref.address + headerSize;
  const end = ref.address + size - 1;
  const next = new C.PointerValue(uintPtr, ref.address + size);
  return {ref, free, start, end, size, next};
};

const getFirstBlock = function (core) {
  const ref = new C.PointerValue(uintPtr, core.heapStart);
  return getBlock(core, ref);
};

const canAllocate = function (block, nBytes) {
  return block.free && block.size - headerSize >= nBytes;
};

const allocateBlock = function (effects, block, nBytes) {
  // Align the block on a 4-byte boundary.
  nBytes = (nBytes + 3) & ~3;
  let netSize = headerSize + nBytes;
  // Can the block be split?
  if (block.size > netSize + headerSize) {
    // Write a header for the (new) next block.
    const nextRef = new C.PointerValue(block.ref.type, block.ref.address + netSize);
    // Compute the next block size, set the free bit.
    const nextHeader = (block.size - netSize) | 1;
    effects.push(['store', nextRef, new C.IntegralValue(uint, nextHeader)]);
  } else {
    // Do not split the block, simply clear its free bit.
    netSize = block.size;
  }
  // The new header is the size in bytes with the free bit (0) clear.
  const newHeader = netSize;
  effects.push(['store', block.ref, new C.IntegralValue(uint, newHeader)]);
  return new C.PointerValue(C.voidPtr, block.start);
};

const freeBlock = function (effects, block, prev, next) {
  let ref = block.ref;
  let size = block.size;
  if (prev && prev.free) {
    ref = prev.ref;
    size += prev.size;
  }
  if (next && next.free) {
    size += next.size;
  }
  // The header is the size in bytes with the free bit (0) *set*.
  effects.push(['store', ref, new C.IntegralValue(uint, size | 1)]);
};

function heapInit (core, stackBytes) {
  const {heapStart} = core;
  const headerRef = new C.PointerValue(uintPtr, core.heapStart);
  const header = new C.IntegralValue(uint, (core.memory.size - heapStart - stackBytes) | 1);
  core.memory = C.writeValue(core.memory, headerRef, header);
  const block = getBlock(core, headerRef);
  const terminator = new C.IntegralValue(uint, 0);
  core.memory = C.writeValue(core.memory, block.next, terminator);
};

export const enumerateHeapBlocks = function* (core) {
  let block = getFirstBlock(core);
  while (block) {
    yield block;
    block = getBlock(core, block.next);
  }
};

function* mallocBuiltin (stepperContext, nBytes) {
  const {core} = stepperContext.state;
  nBytes = nBytes.toInteger();
  const effects = [];
  let result = C.nullPointer;
  for (let block of enumerateHeapBlocks(core)) {
    if (canAllocate(block, nBytes)) {
      result = allocateBlock(effects, block, nBytes);
      break;
    }
  }
  yield* effects;
  yield ['result', result];
};

function* freeBuiltin (stepperContext, ref) {
  // The block chain is traversed for these reasons:
  // * prevent heap corruption;
  // * locate the block immediately before the freed block,
  //   so the blocks can be merged;
  // * performance is low priority.
  const {core} = stepperContext.state;
  const effects = [];
  const address = ref.address;
  let prev;
  for (let block of enumerateHeapBlocks(core)) {
    if (block.start === address) {
      const next = getBlock(core, block.next);
      freeBlock(effects, block, prev, next);
      break;
    }
    prev = block;
  }
  yield* effects;
};

export default function (bundle, deps) {
  bundle.defer(function ({stepperApi}) {
    stepperApi.onInit(function (stepperState) {
      const {core, options} = stepperState;
      heapInit(core, options.stackSize);
    });
    stepperApi.addBuiltin('malloc', mallocBuiltin);
    stepperApi.addBuiltin('free', freeBuiltin);
  });
};
