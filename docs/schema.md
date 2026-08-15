# Trip file schema

One file per trip in `trips/<id>.json`. Everything except `id`, `title` and
`stages` is optional — the build fills in what it can.

## Trip

| Field | Type | Notes |
|---|---|---|
| `id` | string | Must match the filename; becomes `site/<id>.html`. |
| `title` | string | Shown as the page heading and on the index card. |
| `subtitle` | string | One line under the title. |
| `status` | `completed` \| `planned` \| `draft` | Drives the pill colour and index order. |
| `country` | string[] | Shown in the meta line. |
| `dates` | `{start, end}` | `YYYY-MM-DD`, or `null` while unplanned. |
| `bike` | string | Free text, e.g. `Factor Aluto · GP5000 S TR 30 mm`. |
| `geometry_source` | `waypoints` \| `gps` | Informational; the renderer decides per stage. |
| `geometry_note` | string | Printed under the stage table. Say where the line came from. |
| `totals` | object | Any of `distance_km`, `elevation_m`, `moving_time`, `elapsed_time`, `calories`, `avg_power_w`, `high_point_m`, `high_point_name`. Missing ones are summed from the stages. |
| `stages` | array | See below. |

## Stage

| Field | Type | Notes |
|---|---|---|
| `day` | number | Label on the map marker and in the table. |
| `date` | string | `YYYY-MM-DD`. |
| `from` / `to` | string | Stage endpoints, shown in the table. |
| `distance_km` | number | Recorded or planned. The drawn line is rescaled to match it. |
| `elevation_m` | number | Gain. Never derived from a schematic line. |
| `elevation_source` | `recorded` \| `computed` \| `estimated` | Where that number came from. |
| `moving_time` | string | Free text, e.g. `5h35`. |
| `avg_hr`, `avg_power_w` | number | Optional ride metrics. |
| `note` | string | One line under the stage row. |
| `waypoints` | array | Schematic geometry — see below. Always keep these: they label the map. |
| `track` | `[[lat, lon, ele], …]` | Recorded trace. Takes precedence over `waypoints` for drawing. |

## Waypoint

```json
{"name": "Col du Galibier", "lat": 45.0642, "lon": 6.4078, "ele": 2642, "type": "col"}
```

`type` is one of `start`, `end`, `town`, `col`, `highpoint`, or omitted.
Only `col` and `highpoint` get a labelled diamond on the map; `start` and `end`
are inferred from position in the list, so the type is documentation.
