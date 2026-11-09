# Built-in tools are pipelines in code, chosen for real jobs

Built-in tools are pipelines defined in `src/features/built-in-tools/tools.ts` and shown with the
same page as saved pipeline tools, at `/tools/<slug>`. Saved pipelines keep `/tools/<id>` with a
random UUID, so the two never collide, the page renders on the server for built-in slugs only, and
saved pipeline pages ask not to be indexed because their address means nothing outside one
browser. A tool can show the settings of chosen nodes, such as the watermark text, and can name
what must be set before it runs, such as a logo; everything else stays as the pipeline defines it,
and Open in the Studio carries the changed settings over.

The list is short on purpose. A job earns a page only when people search for it by name in large
numbers, repeat it, and Hexlode does all of it on the device better than one quick tool. That rules
out a page per format pair: Convert already does PNG to JPG. The two exceptions, HEIC to JPG and
WebP to JPG, exist because the source format is the problem people search for (phones save HEIC,
websites serve WebP, and many apps open neither), and WebP to JPG also fills transparency with
white instead of black. Tools that follow a platform's rules name the guidance and the date it was
checked on the page, so a reader can see when the numbers might be stale.
