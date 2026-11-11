// alpstuga-card: air quality card for an IKEA ALPSTUGA (Matter) — CO₂ on an arc gauge, PM2.5 / temperature /
// humidity tiles, and a 24 h graph of whichever reading is selected (hover or drag on it for time and value).
// Follows the Home Assistant theme; UI in English or Spanish, picked from the Home Assistant language.
//
// type: custom:alpstuga-card
// name: Bedroom
// co2: sensor.alpstuga_air_quality_monitor_carbon_dioxide
// pm25: sensor.alpstuga_air_quality_monitor_pm2_5
// temperature: sensor.alpstuga_air_quality_monitor_temperature
// humidity: sensor.alpstuga_air_quality_monitor_humidity
// air_quality: sensor.alpstuga_air_quality_monitor_air_quality   (the monitor's own verdict, optional)
// hours: 24
// language: en | es   (optional, default: the Home Assistant language)
// Thresholds: co2_warn 1000, co2_alert 1400 ppm; pm25_warn 15, pm25_alert 35 µg/m³ (WHO 24 h guideline 15);
// humidity comfort hum_low 40 – hum_high 60 %.
const AC_VERSION = '1.3.1';

const AC_COLORS = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', neutral: 'var(--secondary-text-color)' };
// Matter air quality enum, best to worst.
const AC_QUALITY_COLORS = { good: '#22c55e', fair: '#84cc16', moderate: '#eab308', poor: '#f97316', very_poor: '#ef4444', extremely_poor: '#a855f7' };
const AC_I18N = {
  en: {
    title: 'Air quality', air: (q) => `${q.charAt(0).toUpperCase()}${q.slice(1)} air`,
    quality: { good: 'good', fair: 'fair', moderate: 'moderate', poor: 'poor', very_poor: 'very poor', extremely_poor: 'extremely poor' },
    good: 'Good', ventilate: 'Ventilate', high: 'High', elevated: 'Elevated', humid: 'Humid', dry: 'Dry', comfort: 'Comfortable', nodata: 'No data',
    temperature: 'Temperature', humidity: 'Humidity', ago: (h) => `${h} h ago`, now: 'now', nohistory: 'No history yet',
    min: 'min', max: 'max', yesterday: 'yesterday',
  },
  es: {
    title: 'Calidad del aire', air: (q) => `Aire ${q}`,
    quality: { good: 'bueno', fair: 'aceptable', moderate: 'moderado', poor: 'malo', very_poor: 'muy malo', extremely_poor: 'pésimo' },
    good: 'Bien', ventilate: 'Ventilar', high: 'Alto', elevated: 'Elevado', humid: 'Húmedo', dry: 'Seco', comfort: 'Confort', nodata: 'Sin dato',
    temperature: 'Temperatura', humidity: 'Humedad', ago: (h) => `hace ${h} h`, now: 'ahora', nohistory: 'Sin historial todavía',
    min: 'mín', max: 'máx', yesterday: 'ayer',
  },
};
// Outdoor air is ~420 ppm: a CO₂ reading under this is a glitch (an ALPSTUGA sent 0 ppm once), left out of the
// graph and its min/max.
const AC_CO2_FLOOR = 300;
const AC_DEFAULTS = { hours: 24, co2_warn: 1000, co2_alert: 1400, co2_max: 2000, pm25_warn: 15, pm25_alert: 35, hum_low: 40, hum_high: 60 };
// Visual editor labels.
const AC_EDITOR_I18N = {
  en: {
    name: 'Name', co2: 'CO₂ sensor', pm25: 'PM2.5 sensor', temperature: 'Temperature sensor', humidity: 'Humidity sensor',
    air_quality: 'Air quality sensor (the monitor\'s own verdict)', hours: 'Hours in the graph', language: 'Language',
    auto: 'Automatic (Home Assistant language)', thresholds: 'Thresholds',
    co2_warn: 'CO₂: ventilate from (ppm)', co2_alert: 'CO₂: high from (ppm)', co2_max: 'CO₂: end of the gauge (ppm)',
    pm25_warn: 'PM2.5: elevated from (µg/m³)', pm25_alert: 'PM2.5: high from (µg/m³)', hum_low: 'Humidity: dry below (%)', hum_high: 'Humidity: humid above (%)',
    default: (v) => `Default: ${v}`, required: 'Required',
  },
  es: {
    name: 'Nombre', co2: 'Sensor de CO₂', pm25: 'Sensor de PM2.5', temperature: 'Sensor de temperatura', humidity: 'Sensor de humedad',
    air_quality: 'Sensor de calidad del aire (el veredicto del propio monitor)', hours: 'Horas en la gráfica', language: 'Idioma',
    auto: 'Automático (idioma de Home Assistant)', thresholds: 'Umbrales',
    co2_warn: 'CO₂: ventilar desde (ppm)', co2_alert: 'CO₂: alto desde (ppm)', co2_max: 'CO₂: final del arco (ppm)',
    pm25_warn: 'PM2.5: elevado desde (µg/m³)', pm25_alert: 'PM2.5: alto desde (µg/m³)', hum_low: 'Humedad: seco por debajo de (%)', hum_high: 'Humedad: húmedo por encima de (%)',
    default: (v) => `Por defecto: ${v}`, required: 'Obligatorio',
  },
};

const acEsc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class AlpstugaCard extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._metric = 'co2';
    this._hist = {};
    this._histAt = 0;
  }

  static getConfigElement() {
    return document.createElement('alpstuga-card-editor');
  }

  // Card picker: the first CO₂ sensor (an ALPSTUGA one if there is one) and the other sensors of the same device.
  // Same device = same device_id in the entity registry; without it, the entity id closest to the CO₂ one
  // (longest shared prefix, same "_2"-style suffix), since names differ per language.
  static getStubConfig(hass) {
    const states = Object.values((hass && hass.states) || {}).filter((s) => s.entity_id.startsWith('sensor.'));
    const reg = (hass && hass.entities) || {};
    const co2s = states.filter((s) => s.attributes.device_class === 'carbon_dioxide').map((s) => s.entity_id);
    const co2 = co2s.find((id) => id.includes('alpstuga')) || co2s[0];
    const cfg = { co2: co2 || 'sensor.alpstuga_air_quality_monitor_carbon_dioxide' };
    if (!co2) return cfg;
    const dev = reg[co2] && reg[co2].device_id;
    const suffix = (id) => (id.match(/_(\d+)$/) || [])[1] || '';
    const shared = (id) => { let i = 0; while (i < id.length && id[i] === co2[i]) i++; return i; };
    const score = (id) => (dev && reg[id] && reg[id].device_id === dev ? 10000 : 0) + (suffix(id) === suffix(co2) ? 1000 : 0) + shared(id);
    const best = (filter) => states.filter(filter).map((s) => s.entity_id).sort((a, b) => score(b) - score(a))[0];
    for (const [key, dc] of [['pm25', 'pm25'], ['temperature', 'temperature'], ['humidity', 'humidity']]) {
      const id = best((s) => s.attributes.device_class === dc);
      if (id) cfg[key] = id;
    }
    // The monitor's own verdict: an enum sensor whose options are the Matter air quality levels.
    const aq = best((s) => s.attributes.device_class === 'enum' && (s.attributes.options || []).includes('good') && (s.attributes.options || []).includes('poor'));
    if (aq) cfg.air_quality = aq;
    return cfg;
  }

  setConfig(config) {
    if (!config || !config.co2) throw new Error('alpstuga-card: "co2" (the CO₂ sensor) is required');
    this._config = { ...AC_DEFAULTS, ...config };
    this._built = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._render();
    // HA sets hass on every state change in the house, several times a second: only redraw when one of this
    // card's own sensors changed, so taps aren't lost to a redraw between press and release.
    else if (this._changed()) this._update();
    // History for the graph: on the first assignment, then every 5 minutes.
    if (first || Date.now() - this._histAt > 5 * 60 * 1000) this._fetchHistory();
  }

  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }

  // ---------- language ----------
  _setLanguage() {
    const own = this._config.language !== 'auto' && this._config.language;
    const lang = String(own || this._hass.language || 'en').toLowerCase();
    this._t = AC_I18N[lang.slice(0, 2)] || AC_I18N.en;
    this._locale = (this._hass.locale && this._hass.locale.language) || this._hass.language || 'en';
  }

  _fmt(v, d) {
    return new Intl.NumberFormat(this._locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  }

  // ---------- readings ----------
  // True when any of the card's entities has a new state object since the last call.
  _changed() {
    const ids = [...this._metrics().map((m) => m.entity), this._config.air_quality].filter(Boolean);
    const now = ids.map((id) => this._hass.states[id]);
    const changed = !this._seen || now.some((s, i) => s !== this._seen[i]);
    this._seen = now;
    return changed;
  }

  _metrics() {
    const c = this._config, t = this._t || AC_I18N.en;
    return [
      { key: 'co2', entity: c.co2, label: 'CO₂', icon: 'mdi:molecule-co2', decimals: 0 },
      { key: 'pm25', entity: c.pm25, label: 'PM2.5', icon: 'mdi:blur', decimals: 0 },
      { key: 'temperature', entity: c.temperature, label: t.temperature, icon: 'mdi:thermometer', decimals: 1 },
      { key: 'humidity', entity: c.humidity, label: t.humidity, icon: 'mdi:water-percent', decimals: 0 },
    ].filter((m) => m.entity);
  }

  _num(entity) {
    const s = entity && this._hass.states[entity];
    const v = s ? parseFloat(s.state) : NaN;
    return Number.isFinite(v) ? v : null;
  }

  _unit(entity, fallback = '') {
    const s = entity && this._hass.states[entity];
    return (s && s.attributes.unit_of_measurement) || fallback;
  }

  // Band for a value: colour + short word, from the configured thresholds.
  _band(key, v) {
    const c = this._config, t = this._t;
    if (v === null) return { color: AC_COLORS.neutral, word: t.nodata };
    if (key === 'co2') return v >= c.co2_alert ? { color: AC_COLORS.bad, word: t.high } : v >= c.co2_warn ? { color: AC_COLORS.warn, word: t.ventilate } : { color: AC_COLORS.good, word: t.good };
    if (key === 'pm25') return v >= c.pm25_alert ? { color: AC_COLORS.bad, word: t.high } : v >= c.pm25_warn ? { color: AC_COLORS.warn, word: t.elevated } : { color: AC_COLORS.good, word: t.good };
    if (key === 'humidity') return v > c.hum_high ? { color: AC_COLORS.warn, word: t.humid } : v < c.hum_low ? { color: AC_COLORS.warn, word: t.dry } : { color: AC_COLORS.good, word: t.comfort };
    return { color: 'var(--primary-text-color)', word: '' };
  }

  // ---------- history ----------
  async _fetchHistory() {
    this._histAt = Date.now();
    const ids = this._metrics().map((m) => m.entity);
    const start = new Date(Date.now() - this._config.hours * 3600 * 1000).toISOString();
    try {
      const res = await this._hass.callWS({ type: 'history/history_during_period', start_time: start, entity_ids: ids, minimal_response: true, no_attributes: true });
      for (const id of ids) {
        const floor = id === this._config.co2 ? AC_CO2_FLOOR : -Infinity;
        this._hist[id] = (res[id] || [])
          .map((r) => [(r.lu ?? r.lc) * 1000, parseFloat(r.s)])
          .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v) && v >= floor);
      }
    } catch (e) {
      this._hist = {};
    }
    if (this._built) this._updateGraph();
  }

  // ---------- render ----------
  _render() {
    const c = this._config;
    this._setLanguage();
    const t = this._t;
    this._root.innerHTML = `<style>
:host{display:block}
ha-card{padding:16px 16px 12px;overflow:hidden}
.hd{display:flex;align-items:center;gap:8px;min-height:28px}
.hd .n{font-size:16px;font-weight:600;color:var(--primary-text-color);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;
  background:color-mix(in srgb,var(--qc) 16%,transparent);color:var(--qc);cursor:pointer}
.pill i{width:8px;height:8px;border-radius:50%;background:var(--qc)}
.hero{position:relative;display:flex;justify-content:center;margin:4px 0 2px;cursor:pointer}
.hero svg{width:min(240px,80%);height:auto;display:block}
.hero .v{position:absolute;left:0;right:0;top:40%;text-align:center}
.hero .big{font-size:40px;font-weight:300;line-height:1;color:var(--primary-text-color);letter-spacing:-.5px}
.hero .u{font-size:14px;color:var(--secondary-text-color);margin-left:3px}
.hero .w{font-size:13px;font-weight:600;margin-top:4px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}
.t{border-radius:12px;padding:8px 10px;background:var(--secondary-background-color,rgba(127,127,127,.08));cursor:pointer;
  border:1.5px solid transparent;transition:border-color .15s,background .15s;min-width:0}
.t.on{border-color:var(--tc);background:color-mix(in srgb,var(--tc) 10%,var(--secondary-background-color,transparent))}
.t .l{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--secondary-text-color);white-space:nowrap}
.t .l ha-icon{--mdc-icon-size:15px;color:var(--tc)}
.t .x{font-size:20px;font-weight:500;color:var(--primary-text-color);margin-top:2px;white-space:nowrap}
.t .x small{font-size:11px;color:var(--secondary-text-color);font-weight:400;margin-left:2px}
.t .w{font-size:11px;font-weight:600;color:var(--tc);margin-top:1px;min-height:14px}
.g{margin-top:12px}
.gh{display:flex;align-items:baseline;gap:6px;font-size:12px;color:var(--secondary-text-color);cursor:pointer}
.gh b{color:var(--primary-text-color);font-weight:600}
.gh .mm{margin-left:auto;white-space:nowrap}
.gw{position:relative;margin-top:4px;touch-action:pan-y;cursor:crosshair}
.g svg{width:100%;height:84px;display:block;overflow:visible}
.ax{display:flex;justify-content:space-between;font-size:10px;color:var(--secondary-text-color);margin-top:2px}
.none{height:84px;display:grid;place-items:center;font-size:12px;color:var(--secondary-text-color)}
/* Hover / drag readout on the graph: a vertical line, a dot on the value and a label with time and value. */
.cur,.pt,.tip{position:absolute;pointer-events:none;opacity:0;transition:opacity .12s}
.gw.hov .cur,.gw.hov .pt,.gw.hov .tip{opacity:1}
.cur{top:0;bottom:0;width:1px;background:var(--secondary-text-color);opacity:0}
.gw.hov .cur{opacity:.45}
.pt{width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:var(--ha-card-background,var(--card-background-color,#fff));border:2px solid var(--gc)}
.tip{top:-6px;transform:translate(-50%,-100%);padding:3px 8px;border-radius:8px;font-size:11px;white-space:nowrap;
  background:var(--primary-text-color);color:var(--ha-card-background,var(--card-background-color,#fff))}
.tip b{font-weight:600}
.tip.l{transform:translate(0,-100%)}
.tip.r{transform:translate(-100%,-100%)}
</style>
<ha-card>
  <div class="hd"><span class="n">${acEsc(c.name || t.title)}</span><span class="pill" id="pill"><i></i><span id="pilltx"></span></span></div>
  <div class="hero" id="hero" title="CO₂">
    <svg viewBox="0 0 200 150" aria-hidden="true">
      <path id="trk" d="${this._arc(0, 1)}" fill="none" stroke="var(--divider-color,rgba(127,127,127,.2))" stroke-width="12" stroke-linecap="round"/>
      <g id="bands"></g>
      <path id="val" fill="none" stroke-width="12" stroke-linecap="round"/>
      <circle id="dot" r="7.5" fill="var(--ha-card-background,var(--card-background-color,#fff))" stroke-width="4"/>
    </svg>
    <div class="v"><span class="big" id="co2v">—</span><span class="u" id="co2u"></span><div class="w" id="co2w"></div></div>
  </div>
  <div class="tiles" id="tiles"></div>
  <div class="g">
    <div class="gh" id="gh"></div>
    <div class="gw" id="gw"><div id="gbody"></div><div class="cur" id="cur"></div><div class="pt" id="pt"></div><div class="tip" id="tip"></div></div>
    <div class="ax"><span>${acEsc(t.ago(c.hours))}</span><span>${acEsc(t.now)}</span></div>
  </div>
</ha-card>`;
    const $ = (id) => this._root.getElementById(id);
    this._$ = $;
    $('hero').addEventListener('click', () => this._select('co2'));
    $('pill').addEventListener('click', () => this._more(c.air_quality || c.co2));
    $('gh').addEventListener('click', () => this._more(this._metrics().find((m) => m.key === this._metric).entity));
    // Tiles are built once and only their text changes afterwards (rebuilding them on every update lost taps).
    this._tileEls = {};
    for (const m of this._metrics().filter((x) => x.key !== 'co2')) {
      const el = document.createElement('div');
      el.className = 't';
      el.title = m.label;
      el.innerHTML = `<div class="l"><ha-icon icon="${m.icon}"></ha-icon>${acEsc(m.label)}</div><div class="x"><span></span><small></small></div><div class="w"></div>`;
      el.addEventListener('click', () => this._select(m.key));
      $('tiles').appendChild(el);
      this._tileEls[m.key] = { el, v: el.querySelector('.x span'), u: el.querySelector('.x small'), w: el.querySelector('.w') };
    }
    // Graph readout: mouse hover, or press and drag on a touch screen (vertical scrolling still works).
    const gw = $('gw');
    gw.addEventListener('pointermove', (e) => this._readout(e));
    gw.addEventListener('pointerdown', (e) => this._readout(e));
    gw.addEventListener('pointerleave', () => this._hideReadout(0));
    gw.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') this._hideReadout(1800); });
    gw.addEventListener('pointercancel', () => this._hideReadout(0));
    // Faint threshold bands under the CO₂ arc: green to warn, amber to alert, red beyond.
    const f = (v) => Math.min(1, v / c.co2_max);
    $('bands').innerHTML = [[0, f(c.co2_warn), AC_COLORS.good], [f(c.co2_warn), f(c.co2_alert), AC_COLORS.warn], [f(c.co2_alert), 1, AC_COLORS.bad]]
      .map(([a, b, col]) => `<path d="${this._arc(a, b)}" fill="none" stroke="${col}" stroke-opacity=".22" stroke-width="12"/>`).join('');
    this._built = true;
    this._update();
    this._updateGraph();
  }

  // Arc from fraction a to b of a 240° gauge centred at (100, 100), radius 80.
  _arc(a, b) {
    const R = 80, cx = 100, cy = 100, start = 150, span = 240;
    const pt = (f) => {
      const ang = ((start + span * f) * Math.PI) / 180;
      return [cx + R * Math.cos(ang), cy + R * Math.sin(ang)];
    };
    const [x1, y1] = pt(a), [x2, y2] = pt(Math.max(a + 0.0001, b));
    const large = span * (b - a) > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  _update() {
    const c = this._config, $ = this._$, t = this._t;
    // Header pill: the monitor's own verdict, or the CO₂ band without it.
    const aq = c.air_quality && this._hass.states[c.air_quality];
    const qColor = aq && AC_QUALITY_COLORS[aq.state];
    const co2 = this._num(c.co2);
    const b = this._band('co2', co2);
    $('pill').style.setProperty('--qc', qColor || b.color);
    $('pilltx').textContent = qColor ? t.air(t.quality[aq.state]) : b.word;
    // CO₂ hero.
    $('co2v').textContent = co2 === null ? '—' : this._fmt(co2, 0);
    $('co2u').textContent = this._unit(c.co2, 'ppm');
    $('co2w').textContent = co2 === null ? '' : b.word;
    $('co2w').style.color = b.color;
    const fr = co2 === null ? 0 : Math.max(0.0001, Math.min(1, co2 / c.co2_max));
    $('val').setAttribute('d', this._arc(0, fr));
    $('val').setAttribute('stroke', co2 === null ? 'transparent' : b.color);
    const ang = ((150 + 240 * fr) * Math.PI) / 180;
    $('dot').setAttribute('cx', (100 + 80 * Math.cos(ang)).toFixed(2));
    $('dot').setAttribute('cy', (100 + 80 * Math.sin(ang)).toFixed(2));
    $('dot').setAttribute('stroke', co2 === null ? 'transparent' : b.color);
    $('dot').style.display = co2 === null ? 'none' : '';
    // Tiles: PM2.5, temperature, humidity (text only, the elements stay).
    for (const m of this._metrics().filter((x) => x.key !== 'co2')) {
      const tile = this._tileEls[m.key];
      const v = this._num(m.entity);
      const band = this._band(m.key, v);
      tile.el.style.setProperty('--tc', m.key === 'temperature' ? 'var(--state-sensor-temperature-color,#f97316)' : band.color);
      tile.v.textContent = v === null ? '—' : this._fmt(v, m.decimals);
      tile.u.textContent = this._unit(m.entity);
      tile.w.textContent = m.key === 'temperature' ? '' : band.word;
    }
    this._markSelected();
    this._updateGraphHeader();
  }

  _markSelected() {
    for (const [key, t] of Object.entries(this._tileEls)) t.el.classList.toggle('on', key === this._metric);
  }

  _select(key) {
    if (this._metric === key) return;
    this._metric = key;
    this._markSelected();
    this._hideReadout(0);
    this._updateGraph();
  }

  // Time and value under the pointer: the value in effect then (readings hold until the next one).
  _readout(e) {
    const g = this._g;
    if (!g) return;
    clearTimeout(this._hideTimer);
    const gw = this._$('gw');
    const rect = gw.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = g.t0 + f * (g.now - g.t0);
    let lo = 0, hi = g.pts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (g.pts[mid][0] <= t) lo = mid; else hi = mid - 1; }
    const v = g.pts[lo][1];
    const svgH = this._$('gbody').getBoundingClientRect().height || 84;
    const px = f * rect.width;
    this._$('cur').style.left = `${px}px`;
    const pt = this._$('pt');
    pt.style.left = `${px}px`;
    pt.style.top = `${(g.y(v) / g.H) * svgH}px`;
    gw.style.setProperty('--gc', g.col);
    const tip = this._$('tip');
    const when = new Date(t);
    const today = when.toDateString() === new Date().toDateString();
    const hhmm = when.toLocaleTimeString(this._locale, { hour: '2-digit', minute: '2-digit' });
    tip.innerHTML = `${today ? '' : `${acEsc(this._t.yesterday)} `}${hhmm} · <b>${this._fmt(v, g.m.decimals)} ${acEsc(this._unit(g.m.entity))}</b>`;
    tip.style.left = `${px}px`;
    tip.classList.toggle('l', f < 0.15);
    tip.classList.toggle('r', f > 0.85);
    gw.classList.add('hov');
  }

  _hideReadout(ms) {
    clearTimeout(this._hideTimer);
    const gw = this._$ && this._$('gw');
    if (!gw) return;
    this._hideTimer = setTimeout(() => gw.classList.remove('hov'), ms);
  }

  _more(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }

  _updateGraphHeader() {
    const m = this._metrics().find((x) => x.key === this._metric);
    const pts = this._hist[m.entity] || [];
    const vals = pts.map((p) => p[1]);
    const unit = this._unit(m.entity);
    const t = this._t;
    const mm = vals.length ? `${t.min} ${this._fmt(Math.min(...vals), m.decimals)} · ${t.max} ${this._fmt(Math.max(...vals), m.decimals)} ${unit}` : '';
    this._$('gh').innerHTML = `<b>${acEsc(m.label)}</b><span>· ${this._config.hours} h</span><span class="mm">${acEsc(mm)}</span>`;
  }

  _updateGraph() {
    if (!this._built) return;
    const m = this._metrics().find((x) => x.key === this._metric);
    const now = Date.now(), t0 = now - this._config.hours * 3600 * 1000;
    let pts = (this._hist[m.entity] || []).filter(([t]) => t <= now);
    const cur = this._num(m.entity);
    if (cur !== null) pts = [...pts, [now, cur]];
    this._updateGraphHeader();
    const body = this._$('gbody');
    this._g = null;
    if (pts.length < 2) { body.innerHTML = `<div class="none">${acEsc(this._t.nohistory)}</div>`; return; }
    // Values before the window start at its left edge (history includes the state at the start).
    pts = pts.map(([t, v]) => [Math.max(t, t0), v]);
    const c = this._config;
    const lines = m.key === 'co2' ? [c.co2_warn, c.co2_alert] : m.key === 'pm25' ? [c.pm25_warn, c.pm25_alert] : m.key === 'humidity' ? [c.hum_low, c.hum_high] : [];
    const vals = pts.map((p) => p[1]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    // Show a threshold line only if it's near the data, so a quiet day isn't squashed against the floor.
    const shown = lines.filter((l) => l >= lo - (hi - lo) * 0.6 && l <= hi + (hi - lo) * 0.6 + 1);
    lo = Math.min(lo, ...shown); hi = Math.max(hi, ...shown);
    const pad = (hi - lo) * 0.12 || 1;
    lo -= pad; hi += pad;
    const W = 300, H = 84;
    const x = (t) => ((t - t0) / (now - t0)) * W;
    const y = (v) => H - ((v - lo) / (hi - lo)) * H;
    // Step line: sensors report on change, so each value holds until the next one.
    let d = `M ${x(pts[0][0]).toFixed(1)} ${y(pts[0][1]).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += ` H ${x(pts[i][0]).toFixed(1)} V ${y(pts[i][1]).toFixed(1)}`;
    const col = m.key === 'temperature' ? 'var(--state-sensor-temperature-color,#f97316)' : m.key === 'humidity' ? '#3b82f6' : this._band(m.key, cur).color;
    this._g = { pts, t0, now, y, H, m, col }; // for the hover readout
    const id = `gr${Math.random().toString(36).slice(2, 8)}`;
    body.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${acEsc(m.label)} ${c.hours} h">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      ${shown.map((l) => `<line x1="0" x2="${W}" y1="${y(l).toFixed(1)}" y2="${y(l).toFixed(1)}" stroke="var(--secondary-text-color)" stroke-opacity=".35" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`).join('')}
      <path d="${d} V ${H} H ${x(pts[0][0]).toFixed(1)} Z" fill="url(#${id})" stroke="none"/>
      <path d="${d}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    </svg>`;
  }
}

// Visual editor: Home Assistant's own form (ha-form) with entity pickers filtered by sensor type, and the thresholds
// in a collapsible section. Empty fields fall back to the defaults and are left out of the saved config.
class AlpstugaCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _t() {
    const own = this._config && this._config.language !== 'auto' && this._config.language;
    const lang = String(own || (this._hass && this._hass.language) || 'en').slice(0, 2);
    return AC_EDITOR_I18N[lang] || AC_EDITOR_I18N.en;
  }

  _schema() {
    const t = this._t();
    const sensor = (device_class) => ({ entity: { domain: 'sensor', device_class } });
    const num = (min, max, step = 1) => ({ number: { min, max, step, mode: 'box' } });
    return [
      { name: 'name', selector: { text: {} } },
      { name: 'co2', required: true, selector: sensor('carbon_dioxide') },
      { name: 'pm25', selector: sensor('pm25') },
      { name: 'temperature', selector: sensor('temperature') },
      { name: 'humidity', selector: sensor('humidity') },
      { name: 'air_quality', selector: sensor('enum') },
      {
        type: 'grid', name: '', schema: [
          { name: 'hours', selector: num(1, 168) },
          { name: 'language', selector: { select: { mode: 'dropdown', options: [{ value: 'auto', label: t.auto }, { value: 'en', label: 'English' }, { value: 'es', label: 'Español' }] } } },
        ],
      },
      {
        type: 'expandable', name: '', title: t.thresholds, icon: 'mdi:tune-vertical', flatten: true, schema: [
          { type: 'grid', name: '', schema: [{ name: 'co2_warn', selector: num(400, 5000, 50) }, { name: 'co2_alert', selector: num(400, 5000, 50) }] },
          { name: 'co2_max', selector: num(1000, 10000, 100) },
          { type: 'grid', name: '', schema: [{ name: 'pm25_warn', selector: num(1, 500) }, { name: 'pm25_alert', selector: num(1, 500) }] },
          { type: 'grid', name: '', schema: [{ name: 'hum_low', selector: num(0, 100) }, { name: 'hum_high', selector: num(0, 100) }] },
        ],
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.addEventListener('value-changed', (e) => this._changed(e.detail.value));
      this.appendChild(this._form);
    }
    const t = this._t();
    this._form.hass = this._hass;
    // "auto" is only shown in the form, so the dropdown never looks empty; it isn't saved.
    this._form.data = { language: 'auto', ...this._config };
    this._form.schema = this._schema();
    this._form.computeLabel = (s) => t[s.name] || s.title || s.name;
    this._form.computeHelper = (s) => (s.name in AC_DEFAULTS ? t.default(AC_DEFAULTS[s.name]) : undefined);
  }

  _changed(value) {
    const config = { ...value };
    for (const [k, v] of Object.entries(config)) if (v === '' || v === undefined || v === null) delete config[k];
    if (config.language === 'auto') delete config.language;
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }
}

if (!customElements.get('alpstuga-card-editor')) customElements.define('alpstuga-card-editor', AlpstugaCardEditor);

if (!customElements.get('alpstuga-card')) {
  customElements.define('alpstuga-card', AlpstugaCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'alpstuga-card', name: 'ALPSTUGA Air Quality', preview: true, description: 'IKEA ALPSTUGA air quality: CO₂ gauge, PM2.5, temperature, humidity and a 24 h graph' });
  console.info(`%c ALPSTUGA-CARD %c ${AC_VERSION} `, 'background:#22c55e;color:#111;font-weight:700', 'background:#1e2635;color:#fff');
}
