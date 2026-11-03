# Combining nodes pass their inputs on by reference

Deduplicate must see every item before it can say which are duplicates, so it is a combining node,
yet it sends most items on unchanged. Instead of returning the items it read, a combining node
may return `{ port, input }`: the index of an item it received. The engine reloads that item from
where it waited, so the node never holds the batch in memory, and the item keeps its step cache
key and the source it came from, so later nodes reuse their cache and results still list the file.

## Considered options

- Returning the items themselves holds every kept item in memory at once, which grows with batch
  size.
- Deduplicating per item would need a fingerprint store shared between workers, and items in
  flight in other workers could still race past each other.

## Consequences

- Step cache entries record the input index of passed items, and a cache hit reloads them from the
  waiting items of the current run, which every run writes before a combining node runs.
