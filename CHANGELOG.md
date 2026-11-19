# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Changed
- README: the card is now in the default HACS catalog (the Marketplace in
  Home Assistant 2026.11 and later), so installation leads with searching for
  it there; adding it by link stays as a fallback.

## [1.3.2] - 2026-11-17

### Fixed
- Numeric options (`hours` and the thresholds) are now coerced to numbers when
  the config is set, and the graph hours are escaped where they are written into
  markup, so a pasted config can't inject HTML. A value that isn't a number
  falls back to its default.

## [1.3.1] - 2026-11-11

### Added
- HACS validation workflow, run on every push and daily, for the Marketplace
  default catalog.
- README: one-click button to open the repository in your Home Assistant
  Marketplace.

## [1.3.0] - 2026-11-11

### Added
- Visual editor: Home Assistant's own form, with sensor pickers filtered by
  type (CO₂, PM2.5, temperature, humidity, air quality), graph hours, language
  and a collapsible Thresholds section that shows each default. Empty fields
  use the defaults and are left out of the saved config.
- `language: auto` follows the Home Assistant language, the same as leaving it
  out.

## [1.2.0] - 2026-11-11

### Added
- English UI; English or Spanish is picked from the Home Assistant language, or
  set with `language`.
- The card picker finds the CO₂ sensor and the other sensors of the same device
  (by device, or by entity id when the registry isn't available).

## [1.1.0] - 2026-11-11

### Added
- Hover or press-and-drag on the graph shows the time and value at that point.

### Fixed
- Tapping a tile sometimes didn't switch the graph: the tiles were rebuilt on
  every Home Assistant update, several times a second. They are now built once
  and only redrawn when one of the card's own sensors changes.

## [1.0.0] - 2026-11-10

### Added
- First version: CO₂ arc gauge, air quality pill, PM2.5 / temperature /
  humidity tiles and a 24 h graph of the selected reading.
