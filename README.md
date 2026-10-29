# Early Years in Kuwait

An interactive map of Kuwait's nurseries, kindergartens and preschools, built for a presentation.
It is a static site: no API keys, no server, no running costs.

- Map: [MapLibre](https://maplibre.org) with free [OpenFreeMap](https://openfreemap.org) tiles; satellite imagery from Esri.
- Network, glow and pulses: [deck.gl](https://deck.gl) layers drawn under the map labels.
- Data: a one-off scrape of Google Maps listings, saved to `src/data/schools.json`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (add ?nointro to skip the opening flight)
npm run build      # static site in dist/
```

## Refresh the school data

New schools open once or twice a year, so re-run the scraper before an important presentation.
Each step saves progress as it goes; stop it any time (Ctrl-C) and run it again to continue.

```bash
npm run scrape:discover -- --area=kuwait   # 1. search Kuwait area by area (about an hour)
npm run scrape:details                     # 2. open each place for phone, address, photo (about 20 a minute)
npm run scrape:build -- --report --photos  # 3. clean and filter into src/data/schools.json, save photos
```

Useful options: `--workers=2` (parallel browser tabs), `--headed` (watch the browser), `--retry-errors` (details step).

To start completely fresh, delete `data/raw/discovered.json` and `data/raw/details.json` first.

If Google starts showing a "unusual traffic" page, the scripts pause for 5 minutes and try again;
after three strikes they stop. Wait an hour and re-run, or lower `--workers`.

### How the sweep works

Google Maps lists at most 120 results per search. The discover step searches each keyword
(`حضانة`, `روضة`, `nursery`, `preschool`, `kindergarten`) over a grid of map views; a view whose
results are mostly inside it and near the cap is split into four smaller views, until nothing is hidden.

The build step keeps places whose Google category is early-years (nursery school, kindergarten,
preschool, day care…) or whose name clearly says so (حضانة, روضة, nursery, KG…), and drops plant
nurseries, shops and permanently closed places. `data/raw/rejected.json` lists everything dropped and why.

Some listings pass those rules but are not schools: farms called "روضة" (meadow), a livestock pen, a
diwaniya, joke pins. They were checked by hand and are listed with a reason in `scripts/scrape/exclude.json`,
which the build always skips. Remove a line there to bring a place back.

## Notes

- `maplibre-gl` is pinned to v5: deck.gl 9.4's interleaved mode does not work with MapLibre 6 yet.
- The Gulf is labelled "Arabian Gulf" on purpose (`src/map/style.ts`).
- Governorate boundaries: [geoBoundaries](https://www.geoboundaries.org) (ODbL).
