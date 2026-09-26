# The .hexlode pipeline file

Pipelines export as versioned JSON in a `.hexlode` file. Short extensions were taken: `.hex` is
Intel firmware, `.hxl` is Microsoft Help, `.hxp` is Haxe and `.hlx` is an ATI driver format. The
file carries a schema version, and import migrates older versions, so every published version must
stay readable.
