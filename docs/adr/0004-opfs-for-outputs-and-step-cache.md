# OPFS for Output nodes and the step cache

Output nodes and the step cache write items to the Origin Private File System, not to memory or
IndexedDB. OPFS stores data on disk, so memory use does not grow with batch size, and a worker can
write to it with synchronous access handles. The ZIP is built by streaming from OPFS, and the
browser receives it as a file backed by OPFS.

## Consequences

- Temporary run files are deleted after delivery, when a new run starts, and on the next visit.
- Storage in OPFS is strictly necessary for the run the user started, so it needs no consent under
  the EU ePrivacy rules.
- The step cache has a 5 GB default budget and deletes the least recently used results when full.
  Caching every node for large batches can need tens of gigabytes, so recomputing from the nearest
  cached node is cheaper than an unbounded cache.
