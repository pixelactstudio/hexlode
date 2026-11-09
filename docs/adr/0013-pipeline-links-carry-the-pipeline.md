# Pipeline links carry the whole pipeline

A pipeline link puts the pipeline file, deflated and written in base64url, after the `#` of a link
to `/tools/shared`. Browsers never send the part after `#` to a server, so sharing a pipeline needs
no storage, no accounts and no server code, and Hexlode never holds a copy of anyone's pipeline.
The cost is length: a link stays under 7,800 characters after the `#`, which chat apps, email and
every browser keep intact. Templates make links of a few hundred characters; a pipeline with a
large watermark logo does not fit and is shared as a `.hexlode` file instead. The part after `#`
starts with its own version, apart from the file's, so the packing can change while old links keep
opening, and a link unpacks to at most 2 MB, so a crafted link cannot fill the memory. Once a cloud
mode exists, short links stored on a server can sit beside these without replacing them.
