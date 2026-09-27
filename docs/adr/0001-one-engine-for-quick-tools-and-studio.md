# One engine for quick tools and the Studio

Each quick tool is a fixed pipeline that runs on the same engine as the Studio, even though a
Convert page could call an encoder directly. One engine means every node is tested once, quick
tools and Studio pipelines produce identical output, and a saved pipeline can become a pipeline
tool with no extra code.
