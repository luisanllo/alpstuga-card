# Changelog

All notable changes to this project are documented here.

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
