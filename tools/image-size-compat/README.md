# image-size CommonJS compatibility

Metro still declares image-size 1.x and calls its CommonJS export with a Buffer.
Version 1.2.1 has no patched release for GHSA-5p2g-fcmc-qvqq and
GHSA-w3rx-r6r6-pgpr. This adapter delegates parsing to upstream 2.0.4,
preserving the callable export used by Metro and the named export used by
the site. It does not implement or promise the removed v1 file-path/callback API.
All repository callers pass a Buffer. No file format parser is copied here.

Remove this adapter once every Metro consumer declares the patched API.
The security regression checks both the installed Metro call and image metadata.
