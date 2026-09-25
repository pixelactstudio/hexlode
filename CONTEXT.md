# Hexlode

Hexlode processes images in the browser, through quick tools for single jobs and a Studio for
building branching pipelines.

## Language

### Surfaces

**Quick tool**:
A single-purpose page (Convert, Compress, Resize, Strip metadata) that runs a fixed pipeline.
_Avoid_: converter, feature page

**Pipeline tool**:
A saved pipeline opened as a quick tool page, without the canvas.
_Avoid_: custom tool, app

**Studio**:
The desktop editor where users build pipelines on a canvas.
_Avoid_: canvas (as the product name), workspace, editor

### Pipelines

**Pipeline**:
A graph of connected nodes that describes how items are processed.
_Avoid_: recipe, workflow, graph

**Node**:
One processing step in a pipeline, of a given node type such as Resize or Convert.
_Avoid_: operation, block, tool

**Connection**:
A link from one node's output to another node's input.
_Avoid_: edge, wire, link

**Branch**:
The path of nodes after one output of a node.
_Avoid_: route, lane

**Template**:
A ready-made pipeline offered when the Studio opens.
_Avoid_: preset, example

**Pipeline file**:
A pipeline exported as a `.hexlode` file.
_Avoid_: recipe file, export

### Running

**Run**:
One execution of a pipeline over a set of input items.
_Avoid_: job, batch, execution

**Item**:
One unit that flows through a pipeline: an image, data (JSON or text) or a document (PDF).
_Avoid_: file, asset

**Accepts**:
The kinds and formats of items a node can process.
_Avoid_: supports, input types

**Refused**:
A file the Files node turns away before the run because no branch accepts it, or a connection the Studio turns away.
_Avoid_: rejected, blocked

**Skipped**:
An item that a node cannot accept, so it does not enter that branch.
_Avoid_: ignored, dropped, filtered

**Failed**:
An item a node accepted but could not process.
_Avoid_: errored, broken

**Combining node**:
A node that waits for every upstream item and then runs once over all of them, such as Contact sheet.
_Avoid_: gather node, aggregate node, merge node

**Step cache**:
A node's stored results from its last run, reused when nothing upstream changed.
_Avoid_: intermediate, snapshot

**Sample image**:
The image the Studio uses to render live previews on nodes.
_Avoid_: preview image, test image

**Estimate**:
The predicted work and duration of a run, shown before it starts.
_Avoid_: forecast, quote

### Delivery

**Output node**:
A node that saves every item reaching it and passes the item on unchanged.
_Avoid_: download node, sink, export node

**Delivery**:
What an Output node hands to the user when its items are complete: a ZIP or files in a folder.
_Avoid_: download, bundle
