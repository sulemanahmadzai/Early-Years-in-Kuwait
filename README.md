# Early Years in Kuwait

An interactive map of Kuwait's nurseries, kindergartens and preschools, built for a presentation.
It is a static site: no API keys, no server, no running costs.

- Map: [MapLibre](https://maplibre.org) with free [OpenFreeMap](https://openfreemap.org) tiles; satellite imagery from Esri.
- Network, glow and pulses: [deck.gl](https://deck.gl) layers drawn under the map labels.
- Data: a one-off scrape of Google Maps listings, saved to `src/data/schools.json`; government
  kindergartens confirmed against the Ministry of Education's 2024–25 school directory.
- Interface in English and Arabic (right-to-left), switched with the button next to search.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (?nointro skips the opening flight, ?lang=ar opens in Arabic)
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

The build also marks each school government or private (see below), so after a new Ministry directory
comes out, re-run step 4 and then step 3:

```bash
node scripts/moe/kindergartens.mjs path/to/directory.pdf   # 4. needs poppler: brew install poppler
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

Many schools have two Google pins a few metres apart (one without a category, one marked "Preschool",
or "روضة"/"روضه" spellings). The build merges places with the same name within 350 m into one school.

Some real schools have a Google photo of something else (a sofa, a car, a garden, a selfie). Those are
listed in `scripts/scrape/bad-photos.json`; the build drops the photo and the site shows a woven pattern.

## Government or private

`scripts/moe/kindergartens.mjs` reads the kindergarten stage (pages 6–29) of the Ministry of Education's
school directory (دليل المدارس 2024–2025) into `data/moe/government-kindergartens.json`: district, area,
name, founding year, phones, PACI number, block and street for 214 government kindergartens. The PDF
itself is not committed (`data/moe/*.pdf` is ignored); keep a copy to re-run the extraction.

The build matches each Ministry entry to a pin by name within its district (tolerating spelling variants,
a missing "ال", reordered words and the PDF's few unreadable letters), falling back to the phone number.
Matched pins are government kindergartens and get their founding year (and the official phone number when
Google has none); two pins matching one Ministry entry are merged. Everything else is private: nurseries
(حضانة) are privately run, and kindergartens missing from the directory are private ones. Ministry
kindergartens with no pin on Google Maps are listed in `data/raw/moe-not-on-map.json`.

## Switching schools on and off

"Choose schools" (bottom-left panel, or the phone sheet) lists every school with an on/off switch,
filters (name, shown/hidden, governorate) and "Hide these / Show these" for the filtered list. A school
can also be hidden from its detail panel. Hidden schools leave the map, the grid and every count,
including the presentation. The choice is saved in the browser; "Copy link" carries it to another device.

## Notes

- `maplibre-gl` is pinned to v5: deck.gl 9.4's interleaved mode does not work with MapLibre 6 yet.
- The Gulf is labelled "Arabian Gulf" on purpose (`src/map/style.ts`).
- Governorate boundaries: [geoBoundaries](https://www.geoboundaries.org) (ODbL).
