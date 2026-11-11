# ALPSTUGA Air Quality Card

[![Marketplace](https://img.shields.io/badge/Marketplace-Add%20from%20link-41BDF5.svg)](#installation)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/luisanllo/alpstuga-card/blob/main/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/luisanllo/alpstuga-card)](https://github.com/luisanllo/alpstuga-card/releases)

A Lovelace card for Home Assistant built for the **IKEA ALPSTUGA** air quality
monitor (Matter). It shows CO₂ on a colour-banded gauge, PM2.5, temperature and
humidity as tiles, and a 24 h graph of whichever reading you pick — hover over
the graph (or press and drag on a phone) to read the value at any time.

It works with any monitor whose sensors Home Assistant exposes as CO₂, PM2.5,
temperature and humidity entities; only CO₂ is required.

![Light mode preview](https://cdn.jsdelivr.net/gh/luisanllo/alpstuga-card@main/images/preview-light.png) ![Dark mode preview](https://cdn.jsdelivr.net/gh/luisanllo/alpstuga-card@main/images/preview-dark.png)

*Light and dark mode — follows your Home Assistant theme. Left: reading the graph at 04:04.*

## Features

- 🟢 CO₂ on a 240° arc gauge with faint threshold bands and a status word (Good / Ventilate / High)
- 🏷️ The monitor's own air quality verdict (Good, Fair, Moderate, Poor…) as a coloured pill in the header
- 🧩 PM2.5, temperature and humidity tiles, each with its status (WHO PM2.5 guideline, 40–60 % comfort humidity)
- 📈 24 h step graph of the selected reading, with min/max and dashed threshold lines — tap a tile to switch it, tap the CO₂ gauge to go back
- 👆 Hover or drag on the graph for the exact time and value; tap the graph title or the pill for Home Assistant's history dialog
- 🧹 CO₂ readings under 300 ppm are treated as sensor glitches and left out of the graph (outdoor air is ~420 ppm)
- 🌗 Follows Home Assistant's light/dark theme
- 🌍 UI in English or Spanish, picked from your Home Assistant language
- 🔎 When added from the card picker, finds your ALPSTUGA's sensors on its own
- 🎨 Visual editor — no YAML required

## Installation

### Marketplace (Home Assistant 2026.11 or later)

The card isn't in the default catalog, so add it by its link:

[![Open your Home Assistant instance and open this repository in the Marketplace.](https://my.home-assistant.io/badges/marketplace_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=luisanllo&repository=alpstuga-card&category=plugin)

Or by hand:

1. **Settings → Marketplace** → **Add from link** (adding a repository by link
   needs your GitHub account connected to the Marketplace)
2. Enter `https://github.com/luisanllo/alpstuga-card` (or `luisanllo/alpstuga-card`)
3. Download **ALPSTUGA Air Quality Card**
4. Reload the browser, then add the card to a dashboard

### HACS (Home Assistant before 2026.11)

1. **HACS** → ⋮ menu → **Custom repositories**
2. Repository: `https://github.com/luisanllo/alpstuga-card`, type **Dashboard**
3. Search for **"ALPSTUGA Air Quality Card"** → Download
4. Reload the browser, then add the card to a dashboard

### Manual

1. Download [`alpstuga-card.js`](alpstuga-card.js) to `config/www/`
2. Settings → Dashboards → **⋮** menu → Resources → add:
   - URL: `/local/alpstuga-card.js`
   - Type: JavaScript Module

## Configuration

Add the card from the card picker and set it up in the visual editor, or in YAML:

```yaml
type: custom:alpstuga-card
name: Bedroom
co2: sensor.alpstuga_air_quality_monitor_carbon_dioxide
pm25: sensor.alpstuga_air_quality_monitor_pm2_5
temperature: sensor.alpstuga_air_quality_monitor_temperature
humidity: sensor.alpstuga_air_quality_monitor_humidity
air_quality: sensor.alpstuga_air_quality_monitor_air_quality
```

Entity ids depend on your Home Assistant language; the card picker fills them
in for you.

| Option | Required | Default | Description |
|---|---|---|---|
| `co2` | Yes | | CO₂ sensor (ppm) |
| `pm25` | No | | PM2.5 sensor (µg/m³) |
| `temperature` | No | | Temperature sensor |
| `humidity` | No | | Relative humidity sensor |
| `air_quality` | No | | The monitor's air quality sensor (Matter levels `good` … `extremely_poor`); without it the pill shows the CO₂ status |
| `name` | No | `Air quality` | Title shown on the card |
| `hours` | No | `24` | Hours of history in the graph |
| `language` | No | Home Assistant's | `en`, `es`, or `auto` for Home Assistant's |
| `co2_warn` / `co2_alert` | No | `1000` / `1400` | CO₂ levels (ppm) where it turns amber ("Ventilate") and red ("High") |
| `co2_max` | No | `2000` | CO₂ at the end of the gauge |
| `pm25_warn` / `pm25_alert` | No | `15` / `35` | PM2.5 levels (µg/m³) for amber and red; 15 is the WHO 24 h guideline |
| `hum_low` / `hum_high` | No | `40` / `60` | Humidity comfort range (%) |

## License

[MIT](LICENSE)
