# LXGW WenKai build source

The complete font is a build input only. The public site serves the generated
subset at `public/fonts/lxgw-wenkai-subset.woff2`; the 25.9 MB TTF and this
license are not exposed by the static server.

- Upstream: https://github.com/lxgw/LxgwWenKai
- Pinned commit: `7ebd0771fda4285299670f83c398f32f32c7bef8`
- Font path: `fonts/TTF/LXGWWenKai-Regular.ttf`
- Font Git blob SHA-1: `7f8f031dc5c6c5ba1913d93c36d4667c1e311cea`
- Font SHA-256: `2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b`
- Font size: 25,928,940 bytes
- License path: `OFL.txt`
- License Git blob SHA-1: `bb1634cb03ee7202d5c66bf2754705493bd73e1e`
- License SHA-256: `1a25e35da1031c6c3436fde545bb9cb5aca954e9873afe510c834b8b79bd21a0`
- Verified with fontTools/pyftsubset 4.63.0 and ttx 4.63.0

To update the font, choose and record a fixed upstream commit, preserve its full
OFL license, verify both Git blob IDs, regenerate the subset into a candidate,
and run `npm run data:check`. Never overwrite the committed public subset from
the default test or verification command.
