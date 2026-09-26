# Items skip branches they cannot enter

When an item reaches a node that does not accept it, the item skips that branch and keeps flowing
through the other branches. The Files node accepts every format that at least one branch accepts.

## Considered options

A strict rule, where Files accepts only the formats every branch can handle, breaks the most
natural pipeline: one branch for JPEG and one for PNG after the same Files node. We chose skipping
and made it visible instead. A connection that narrows the stream shows a label such as "PNG only",
the Studio explains the behaviour when the connection is made, and runs count skipped items
separately from failed ones.
