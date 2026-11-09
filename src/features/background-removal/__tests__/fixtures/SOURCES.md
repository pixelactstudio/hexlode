# Background removal fixtures

`scripts/generate-background-fixtures.mjs` makes the photos here from the files below, all on
Wikimedia Commons, after checking each download against the SHA-1 Commons publishes. Each
subject is a cut-out with real transparency, composited onto a background at 512 × 342. Its own
transparency gives the reference mask (`<name>-mask.png`) and the subject on white
(`<name>-white.jpg`). The composites and masks are derived from these works and keep their terms.

| Fixture | Subject | Licence | Author |
|---|---|---|---|
| `emac` | [Apple-eMac-FL (transparent).png](https://commons.wikimedia.org/wiki/File:Apple-eMac-FL_(transparent).png) | Public domain | Evan-Amos |
| `daruma` | [Daruma0791 with transparent background.png](https://commons.wikimedia.org/wiki/File:Daruma0791_with_transparent_background.png) | Public domain | Fg2; derivative by Nihonjoe |
| `luggage` | [Luggage-2708806 960 720.png](https://commons.wikimedia.org/wiki/File:Luggage-2708806_960_720.png) | CC0 | Alexas Fotos |
| `cat` | [Cat Stretch.png](https://commons.wikimedia.org/wiki/File:Cat_Stretch.png) | CC0 | Lisafern |
| `woman` | [Woman in White Sleeveless Dress Sitting on Gray Concrete Seat during Daytime transparent.png](https://commons.wikimedia.org/wiki/File:Woman_in_White_Sleeveless_Dress_Sitting_on_Gray_Concrete_Seat_during_Daytime_transparent.png) | CC0 | dzeeshah (Pixabay) |

| Background | Used by | Licence | Author |
|---|---|---|---|
| [Apartment-1851201 960 720.jpg](https://commons.wikimedia.org/wiki/File:Apartment-1851201_960_720.jpg) | `emac`, `luggage`, `woman` | CC0 | Scott Webb |
| [Oxford-182705 960 720.jpg](https://commons.wikimedia.org/wiki/File:Oxford-182705_960_720.jpg) | `daruma`, `cat` | CC0 | papannon |

The home page's moving picture of Remove background uses the Daruma cut-out too, as
`public/home/subject-daruma.webp`.

`threshold.onnx` is made by `scripts/generate-model-fixture.mjs` and is Hexlode's own.
