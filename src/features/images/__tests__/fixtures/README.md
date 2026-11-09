# Image fixtures

Every file here is made by `scripts/generate-fixtures.mjs` and belongs to Hexlode, under the
repository's licence. The script describes each picture and builds its EXIF by hand.

The HEIC files (`photo`, `oriented`, `grid`, `alpha` and `malformed.heic`) are encoded by libheif's
`heif-enc` with x265, laid out as phone cameras write photos: EXIF in its own item, a rotation in
`irot` beside an EXIF orientation of 6, and `grid.heic` cut into tiles with a thumbnail and a
Display P3 colour profile. That profile is `DisplayP3-v4.icc` from
[Compact-ICC-Profiles](https://github.com/saucecontrol/Compact-ICC-Profiles), dedicated to the
public domain under CC0 1.0.
