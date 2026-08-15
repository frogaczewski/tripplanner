#!/usr/bin/env python3
"""Build the static trip site.

    python3 tools/build.py            # build every trip in trips/
    python3 tools/build.py <trip-id>  # build one

Each trip JSON in trips/ becomes site/<id>.html; site/index.html lists them all.
Everything is data-driven: to add a trip, add a JSON file. No code changes.
"""
import json, sys, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRIPS, TPL, SITE = ROOT / "trips", ROOT / "templates", ROOT / "site"


def totals(trip):
    """Fill in trip totals from the stages when they are not stated explicitly."""
    t = dict(trip.get("totals") or {})
    st = trip["stages"]
    if not t.get("distance_km"):
        t["distance_km"] = round(sum(s.get("distance_km") or 0 for s in st), 1)
    if not t.get("elevation_m"):
        t["elevation_m"] = sum(s.get("elevation_m") or 0 for s in st)
    if not t.get("high_point_m"):
        eles = [w["ele"] for s in st for w in s.get("waypoints", [])]
        if eles:
            t["high_point_m"] = max(eles)
    return t


def build_trip(path):
    trip = json.loads(path.read_text())
    trip["totals"] = totals(trip)
    page = (TPL / "trip.html").read_text()
    # Inline Leaflet so each page is a single self-contained file (tiles still need network).
    page = page.replace("__LEAFLET_CSS__", (ROOT / "vendor" / "leaflet.css").read_text())
    page = page.replace("__LEAFLET_JS__", (ROOT / "vendor" / "leaflet.js").read_text())
    page = (page.replace("__TRIP_JSON__", json.dumps(trip, ensure_ascii=False))
                .replace("__TITLE__", html.escape(trip["title"]))
                .replace("__SUBTITLE__", html.escape(trip.get("subtitle", "")))
                .replace("__STATUS__", html.escape(trip.get("status", "planned"))))
    out = SITE / f"{trip['id']}.html"
    out.write_text(page)
    print(f"  {out.relative_to(ROOT)}  ({trip['totals']['distance_km']} km / "
          f"{trip['totals']['elevation_m']} m, {len(trip['stages'])} stages)")
    return trip


def build_index(trips):
    order = {"completed": 0, "planned": 1, "draft": 2}
    trips = sorted(trips, key=lambda t: (order.get(t.get("status"), 9),
                                         t.get("dates", {}).get("start") or "9999"))
    cards = []
    for t in trips:
        d = t.get("dates") or {}
        when = f"{d.get('start')} – {d.get('end')}" if d.get("start") else "dates not set"
        cards.append(
            f'<a class="card" href="{t["id"]}.html">'
            f'<div class="t">{html.escape(t["title"])}'
            f'<span class="pill {t.get("status","planned")}">{t.get("status","planned")}</span></div>'
            f'<div class="s">{html.escape(t.get("subtitle",""))}</div>'
            f'<div class="n">{when} · {t["totals"]["distance_km"]:,} km · '
            f'{t["totals"]["elevation_m"]:,} m · {len(t["stages"])} stages</div></a>')
    page = (TPL / "index.html").read_text().replace("__CARDS__", "\n  ".join(cards))
    (SITE / "index.html").write_text(page)
    print(f"  site/index.html  ({len(trips)} trips)")


def main():
    SITE.mkdir(exist_ok=True)
    want = sys.argv[1] if len(sys.argv) > 1 else None
    files = sorted(TRIPS.glob("*.json"))
    if want:
        files = [f for f in files if f.stem == want] or files
    print("Building:")
    built = [build_trip(f) for f in files]
    build_index(built)


if __name__ == "__main__":
    main()
