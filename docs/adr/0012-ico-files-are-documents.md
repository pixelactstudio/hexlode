# ICO files are documents

Favicon / App icons makes `favicon.ico`. We treat ICO as a document format, beside PDF, rather
than an image format. Image formats are the ones Hexlode decodes and encodes, and every node that
takes images accepts all of them; an ICO image would reach Resize or Convert and fail. As a
document, an ICO file is a finished file that only Output and Rename take, and connections from
Favicon / App icons to image nodes narrow to the PNG icons.
