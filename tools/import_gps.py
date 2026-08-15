#!/usr/bin/env python3
"""Replace a trip's schematic waypoints with a recorded GPS trace.

    python3 tools/import_gps.py <trip-id> data/raw/day1.tcx data/raw/day2.tcx ...

One file per stage, in order. Reads .gpx / .tcx (no dependencies), simplifies the
track to roughly one point every 250 m, and writes it into the trip JSON as
stage["track"] = [[lat, lon, ele], ...]. The renderer prefers "track" over
"waypoints", so the map and the profile switch to the real trace automatically.

Recorded distance and elevation gain are computed and filled in for any stage
that does not already state them; stages that do state them keep their values
(the device's own lap totals are more trustworthy than a re-integration).
Named waypoints are kept — they are what labels the cols on the map.
"""
import json, math, sys, statistics
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
R = 6371008.8  # metres


def haversine(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def strip(tag):
    return tag.split("}")[-1]


def read_points(path):
    """Pull (lat, lon, ele) out of a .gpx or .tcx file."""
    root = ET.parse(path).getroot()
    pts = []
    for el in root.iter():
        t = strip(el.tag)
        if t == "trkpt":  # GPX
            lat, lon = float(el.get("lat")), float(el.get("lon"))
            ele = next((float(c.text) for c in el if strip(c.tag) == "ele" and c.text), None)
            pts.append([lat, lon, ele])
        elif t == "Trackpoint":  # TCX
            pos = ele = None
            for c in el:
                ct = strip(c.tag)
                if ct == "Position":
                    d = {strip(g.tag): float(g.text) for g in c if g.text}
                    if "LatitudeDegrees" in d:
                        pos = [d["LatitudeDegrees"], d["LongitudeDegrees"]]
                elif ct == "AltitudeMeters" and c.text:
                    ele = float(c.text)
            if pos:
                pts.append([pos[0], pos[1], ele])
    # carry elevation across points that recorded none
    last = next((p[2] for p in pts if p[2] is not None), 0.0)
    for p in pts:
        if p[2] is None:
            p[2] = last
        last = p[2]
    return pts


def simplify(pts, min_gap_m=250):
    """Thin the track: keep a point every ~250 m, plus the local extremes."""
    if len(pts) < 3:
        return pts
    out, acc = [pts[0]], 0.0
    for i in range(1, len(pts) - 1):
        acc += haversine(pts[i - 1], pts[i])
        turn = abs(pts[i][2] - out[-1][2]) > 25  # keep sharp elevation changes
        if acc >= min_gap_m or turn:
            out.append(pts[i])
            acc = 0.0
    out.append(pts[-1])
    return out


def gain(pts, window=15, threshold=3.0):
    """Elevation gain: median-filtered altitude, 3 m threshold (matches the ride log)."""
    ele = [p[2] for p in pts]
    sm = [statistics.median(ele[max(0, i - window // 2): i + window // 2 + 1]) for i in range(len(ele))]
    total, ref = 0.0, sm[0]
    for e in sm[1:]:
        if e - ref >= threshold:
            total += e - ref
            ref = e
        elif e < ref:
            ref = e
    return round(total)


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    trip_path = ROOT / "trips" / f"{sys.argv[1]}.json"
    trip = json.loads(trip_path.read_text())
    files = [Path(f) for f in sys.argv[2:]]
    if len(files) != len(trip["stages"]):
        print(f"note: {len(files)} files for {len(trip['stages'])} stages — pairing by order")

    for stage, f in zip(trip["stages"], files):
        raw = read_points(f)
        pts = simplify(raw)
        dist = sum(haversine(raw[i - 1], raw[i]) for i in range(1, len(raw))) / 1000
        stage["track"] = [[round(p[0], 5), round(p[1], 5), round(p[2], 1)] for p in pts]
        stage.setdefault("distance_km", round(dist, 1))
        if not stage.get("elevation_m"):
            stage["elevation_m"] = gain(raw)
            stage["elevation_source"] = "computed"
        print(f"  day {stage.get('day')}: {f.name} — {len(raw)} pts -> {len(pts)}, "
              f"{dist:.1f} km, +{gain(raw)} m")

    trip["geometry_source"] = "gps"
    trip["geometry_note"] = "Recorded GPS trace from " + ", ".join(f.name for f in files)
    trip_path.write_text(json.dumps(trip, ensure_ascii=False, indent=2))
    print(f"wrote {trip_path.relative_to(ROOT)} — now run tools/build.py")


if __name__ == "__main__":
    main()
