# trips

Every bike trip — ridden and planned — as one JSON file each, rendered into an
interactive map by one small build script. Adding a trip means adding a data
file. Nothing in the renderer knows about any particular trip.

```
trips/          one JSON per trip   <- the only thing you edit by hand
templates/      page templates (map page + index)
tools/build.py  trips/*.json -> site/*.html
tools/import_gps.py  .gpx/.tcx -> recorded track inside a trip JSON
vendor/         Leaflet 1.9.4, inlined into each page so a page is one file
data/raw/       drop Garmin exports here (git-ignored)
site/           generated output — safe to delete and rebuild
```

## Use

```bash
python3 tools/build.py                    # build everything
python3 tools/build.py alpine-traverse-2026   # build one trip
open site/index.html
```

No dependencies, no install step. Python 3.9+.

## Adding a trip

1. Copy an existing file in `trips/` and give it a new `id` (the id is the
   filename and the output page name).
2. List the stages. A **planned** trip only needs waypoints — name, lat, lon,
   elevation — and the renderer draws a schematic line through them and builds
   the profile by interpolation.
3. Rebuild.

## Turning a planned trip into a ridden one

After the trip, drop the Garmin files in `data/raw/` and run:

```bash
python3 tools/import_gps.py morocco-atlas-2026 data/raw/day1.tcx data/raw/day2.tcx ...
python3 tools/build.py
```

That writes the recorded trace into the same trip file. The renderer prefers a
recorded `track` over the schematic `waypoints`, so the map and the elevation
profile switch to real data while the col labels and stage notes stay as they
were. Change `status` to `completed` and the index re-sorts itself.

## Design notes

- **Colour means elevation, not identity.** The route is a single sequential
  ramp (one hue, dim → bright) mapped to height, so the same encoding works on
  the map, in the profile fill and on the stage swatches. Stages are told apart
  by numbered markers and by highlight-on-click, never by colour alone.
- **Col labels declutter themselves.** Labels are hidden when they would collide
  with a day marker or with a higher summit's label, and reappear on zoom.
- **Each page is one file.** Leaflet is inlined; only the map tiles need the
  network. Delete `site/` any time.

## Accuracy

Schematic routes are drawn through real coordinates but they do not follow the
road between them, so the drawn line is shorter than reality. Each stage's
cumulative distance is therefore rescaled to the stated `distance_km`, which
keeps the profile's x-axis honest. Elevation gain is never inferred from a
schematic line — it comes from the data file (`elevation_source` records
whether a figure is `recorded`, `computed` or `estimated`).
