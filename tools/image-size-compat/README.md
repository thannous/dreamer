# image-size CommonJS compatibility

Metro still declares image-size 1.x and calls its CommonJS export with a file
path for ordinary assets or a Buffer for assets inside zip archives.
Version 1.2.1 has no patched release for GHSA-5p2g-fcmc-qvqq and
GHSA-w3rx-r6r6-pgpr. This adapter delegates parsing to upstream 2.0.4,
preserving the synchronous callable and named exports. File paths are read with
Node's synchronous filesystem API before parsing; Buffer inputs pass through.
The removed asynchronous callback API is not implemented. No file format parser
is copied here.

Remove this adapter once every Metro consumer declares the patched API.
The regression checks the actual Metro getAssetData file-path route, Buffer
metadata parsing and rejection of a malformed ICNS chunk that could hang v1.
