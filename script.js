/* ==========================================================================
   Weather app logic
   Vanilla JS, no build step. Organized top-to-bottom as:
   1. Config & constants
   2. Icon library (inline SVG)
   3. State
   4. DOM references
   5. Utility helpers
   6. API layer (Open-Meteo geocoding + forecast, BigDataCloud reverse geocode)
   7. Rendering
   8. Sky / background theming
   9. Event wiring
   10. Boot sequence
   ========================================================================== */

/* -------------------------------------------------------------------------
   1. CONFIG
   ------------------------------------------------------------------------- */

const CONFIG = {
  GEOCODE_URL: 'https://geocoding-api.open-meteo.com/v1/search',
  FORECAST_URL: 'https://api.open-meteo.com/v1/forecast',
  // Free, keyless reverse-geocoding, used only to turn "your GPS coordinates"
  // into a readable city name after the browser grants location permission.
  // Open-Meteo's geocoding API is name -> coordinates only, not the reverse.
  REVERSE_GEOCODE_URL: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
  SEARCH_DEBOUNCE_MS: 350,
  HOURLY_HOURS: 24,
  RAIN_HOURS: 18,
};

const WEATHER_CODES = {
  0:  { text: 'Clear sky',            icon: 'clear',   theme: 'clear'  },
  1:  { text: 'Mainly clear',         icon: 'partly',  theme: 'clear'  },
  2:  { text: 'Partly cloudy',        icon: 'partly',  theme: 'cloudy' },
  3:  { text: 'Overcast',             icon: 'cloudy',  theme: 'cloudy' },
  45: { text: 'Fog',                  icon: 'fog',     theme: 'fog'    },
  48: { text: 'Depositing rime fog',  icon: 'fog',     theme: 'fog'    },
  51: { text: 'Light drizzle',        icon: 'drizzle', theme: 'rain'   },
  53: { text: 'Drizzle',              icon: 'drizzle', theme: 'rain'   },
  55: { text: 'Dense drizzle',        icon: 'drizzle', theme: 'rain'   },
  56: { text: 'Freezing drizzle',     icon: 'drizzle', theme: 'rain'   },
  57: { text: 'Dense freezing drizzle', icon: 'drizzle', theme: 'rain' },
  61: { text: 'Slight rain',          icon: 'rain',    theme: 'rain'   },
  63: { text: 'Rain',                 icon: 'rain',    theme: 'rain'   },
  65: { text: 'Heavy rain',           icon: 'rain',    theme: 'rain'   },
  66: { text: 'Freezing rain',        icon: 'rain',    theme: 'rain'   },
  67: { text: 'Heavy freezing rain',  icon: 'rain',    theme: 'rain'   },
  71: { text: 'Slight snow',          icon: 'snow',    theme: 'snow'   },
  73: { text: 'Snow',                 icon: 'snow',    theme: 'snow'   },
  75: { text: 'Heavy snow',           icon: 'snow',    theme: 'snow'   },
  77: { text: 'Snow grains',          icon: 'snow',    theme: 'snow'   },
  80: { text: 'Slight rain showers',  icon: 'rain',    theme: 'rain'   },
  81: { text: 'Rain showers',         icon: 'rain',    theme: 'rain'   },
  82: { text: 'Violent rain showers', icon: 'rain',    theme: 'rain'   },
  85: { text: 'Slight snow showers',  icon: 'snow',    theme: 'snow'   },
  86: { text: 'Heavy snow showers',   icon: 'snow',    theme: 'snow'   },
  95: { text: 'Thunderstorm',         icon: 'storm',   theme: 'storm'  },
  96: { text: 'Thunderstorm, hail',   icon: 'storm',   theme: 'storm'  },
  99: { text: 'Thunderstorm, heavy hail', icon: 'storm', theme: 'storm' },
};

const SKY_THEMES = {
  clear_day:    { top:'#3B8FE0', mid:'#6BB6E8', bottom:'#BFE3F0', horizon:'#1E4E78', accent:'#FFC857' },
  clear_night:  { top:'#0B1220', mid:'#16223B', bottom:'#223255', horizon:'#1B2947', accent:'#D9DEEC' },
  cloudy_day:   { top:'#6D7C93', mid:'#8B98AC', bottom:'#B7C0CE', horizon:'#3C4657', accent:'#FFE3A8' },
  cloudy_night: { top:'#111826', mid:'#1B2434', bottom:'#2B3547', horizon:'#1A2130', accent:'#AEB8CC' },
  rain_day:     { top:'#48576D', mid:'#5E6E82', bottom:'#8A97A6', horizon:'#26313F', accent:'#7EC8E3' },
  rain_night:   { top:'#0D1420', mid:'#151E2C', bottom:'#212B39', horizon:'#151D28', accent:'#7EC8E3' },
  snow_day:     { top:'#7C93AD', mid:'#A9BCCC', bottom:'#DCE6ED', horizon:'#48566A', accent:'#EAF3FA' },
  snow_night:   { top:'#141C2C', mid:'#202A3C', bottom:'#303C50', horizon:'#1B2432', accent:'#C9D8E8' },
  fog_day:      { top:'#8B9199', mid:'#A6ABB1', bottom:'#CBCED2', horizon:'#5A5F66', accent:'#E8EAEC' },
  fog_night:    { top:'#161A20', mid:'#22262D', bottom:'#33373E', horizon:'#1C1F24', accent:'#9AA1AA' },
  storm_day:    { top:'#333B52', mid:'#454F6B', bottom:'#5C6683', horizon:'#20263A', accent:'#B9A6E8' },
  storm_night:  { top:'#0A0D18', mid:'#12162A', bottom:'#1C2038', horizon:'#141830', accent:'#8B7CC8' },
};

/* -------------------------------------------------------------------------
   2. ICON LIBRARY — consistent inline SVG set, all 24x24, currentColor
   ------------------------------------------------------------------------- */

const ICONS = {
  clear: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.6"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M22.5 12h-3M4.5 12h-3M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M19.07 19.07l-2.12-2.12M7.05 7.05L4.93 4.93"/></g></svg>`,
  partly: `<svg viewBox="0 0 24 24" fill="none"><path d="M7 9a4 4 0 1 1 7.9-1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6.5 20h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 10.1 4 4 0 0 0 6.5 20Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  cloudy: `<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 19h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 9.1 4 4 0 0 0 6.5 19Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  fog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 9.5h9a3.5 3.5 0 1 0-.3-6.98A4.8 4.8 0 0 0 5 9.5Z"/><path d="M3 14h18M3 18h18M6 10.5h.01"/></svg>`,
  drizzle: `<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 13h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 3.1 4 4 0 0 0 6.5 13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 17v2M12 17v2M16 17v2"/></g></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 12h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 2.1 4 4 0 0 0 6.5 12Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7.5 16.5l-1.5 3M12.5 16.5L11 19.5M17.5 16.5L16 19.5"/></g></svg>`,
  snow: `<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 12h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 2.1 4 4 0 0 0 6.5 12Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 17v4M8 17l-1.8 1M8 17l1.8 1M8 19l-1.8 1M8 19l1.8 1M16 17v4M16 17l-1.8 1M16 17l1.8 1M16 19l-1.8 1M16 19l1.8 1"/></g></svg>`,
  storm: `<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 11h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 1.1 4 4 0 0 0 6.5 11Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 12l-3.5 5H12l-2 5 5.5-6.5H13l1.5-3.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="currentColor" fill-opacity="0.15"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 8h11a2.5 2.5 0 1 0-2.4-3.2M3 12h15a2.5 2.5 0 1 1-2.4 3.2M3 16h9"/></svg>`,
  humidity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.5S5.5 10.2 5.5 14.8a6.5 6.5 0 0 0 13 0C18.5 10.2 12 2.5 12 2.5Z"/></svg>`,
  pressure: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8.5"/><path d="M12 13l3-3M12 6.5v1.2M6.5 13H5.3M18.7 13h-1.2"/></svg>`,
  visibility: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>`,
  uv: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="14" r="4.2" stroke="currentColor" stroke-width="1.6"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3v2.4M4.5 8.5l1.8 1.4M19.5 8.5l-1.8 1.4M2.5 15h2.4M19.1 15h2.4"/></g></svg>`,
  precip: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5S6.5 10.4 6.5 14.4a5.5 5.5 0 0 0 11 0C17.5 10.4 12 3.5 12 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
};

function iconMarkup(key){ return ICONS[key] || ICONS.clear; }

/* -------------------------------------------------------------------------
   3. STATE
   ------------------------------------------------------------------------- */

const state = {
  unit: localStorage.getItem('weather_unit') || 'celsius', // 'celsius' | 'fahrenheit'
  lastPlace: null,      // { name, country, admin1, latitude, longitude }
  weatherData: null,    // raw API response
  favorites: [],         // array of saved place objects, persisted in localStorage
  compareCity: null,     // second city chosen for comparison
  compareData: null,     // raw API response for the comparison city
  searchResults: [],
  searchFocusIndex: -1,
  compareSearchResults: [],
  precipParticlesTheme: null,
};

/* -------------------------------------------------------------------------
   4. DOM REFERENCES
   ------------------------------------------------------------------------- */

const el = {
  sky: document.getElementById('sky'),
  stars: document.getElementById('stars'),
  celestial: document.getElementById('celestial'),
  precip: document.getElementById('precip'),
  horizonPath: document.getElementById('horizonPath'),

  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  searchClear: document.getElementById('searchClear'),
  searchResults: document.getElementById('searchResults'),
  locateBtn: document.getElementById('locateBtn'),
  unitToggle: document.getElementById('unitToggle'),

  emptyState: document.getElementById('emptyState'),
  loadingState: document.getElementById('loadingState'),
  errorState: document.getElementById('errorState'),
  errorTitle: document.getElementById('errorTitle'),
  errorBody: document.getElementById('errorBody'),
  errorRetry: document.getElementById('errorRetry'),
  weatherView: document.getElementById('weatherView'),

  favoritesBar: document.getElementById('favoritesBar'),
  favoritesList: document.getElementById('favoritesList'),
  favoriteToggle: document.getElementById('favoriteToggle'),

  outfitList: document.getElementById('outfitList'),

  bestTimeRange: document.getElementById('bestTimeRange'),
  bestTimeDetail: document.getElementById('bestTimeDetail'),

  compareInput: document.getElementById('compareInput'),
  compareResults: document.getElementById('compareResults'),
  compareGrid: document.getElementById('compareGrid'),
  compareEmpty: document.getElementById('compareEmpty'),
  compareClear: document.getElementById('compareClear'),
  compareWrap: document.getElementById('compareWrap'),

  cityName: document.getElementById('cityName'),
  countryName: document.getElementById('countryName'),
  currentIcon: document.getElementById('currentIcon'),
  currentTemp: document.getElementById('currentTemp'),
  currentTempUnit: document.getElementById('currentTempUnit'),
  currentCondition: document.getElementById('currentCondition'),
  feelsLikeTemp: document.getElementById('feelsLikeTemp'),
  feelsLikeNote: document.getElementById('feelsLikeNote'),

  storyText: document.getElementById('storyText'),
  precipTimeline: document.getElementById('precipTimeline'),

  humidityValue: document.getElementById('humidityValue'),
  windValue: document.getElementById('windValue'),
  windUnit: document.getElementById('windUnit'),
  windDirection: document.getElementById('windDirection'),
  pressureValue: document.getElementById('pressureValue'),
  visibilityValue: document.getElementById('visibilityValue'),
  visUnit: document.getElementById('visUnit'),
  uvValue: document.getElementById('uvValue'),
  uvLabel: document.getElementById('uvLabel'),
  precipValue: document.getElementById('precipValue'),

  iconHumidity: document.getElementById('iconHumidity'),
  iconWind: document.getElementById('iconWind'),
  iconPressure: document.getElementById('iconPressure'),
  iconVisibility: document.getElementById('iconVisibility'),
  iconUv: document.getElementById('iconUv'),
  iconPrecip: document.getElementById('iconPrecip'),

  graphSvg: document.getElementById('graphSvg'),
  graphFill: document.getElementById('graphFill'),
  graphLine: document.getElementById('graphLine'),
  graphDots: document.getElementById('graphDots'),
  hourlyScroll: document.getElementById('hourlyScroll'),
  dailyList: document.getElementById('dailyList'),

  sunDot: document.getElementById('sunDot'),
  sunriseTime: document.getElementById('sunriseTime'),
  sunsetTime: document.getElementById('sunsetTime'),
  sunStatus: document.getElementById('sunStatus'),
};

// static icons that never change
el.iconHumidity.innerHTML = iconMarkup('humidity');
el.iconWind.innerHTML = iconMarkup('wind');
el.iconPressure.innerHTML = iconMarkup('pressure');
el.iconVisibility.innerHTML = iconMarkup('visibility');
el.iconUv.innerHTML = iconMarkup('uv');
el.iconPrecip.innerHTML = iconMarkup('precip');

/* -------------------------------------------------------------------------
   5. UTILITY HELPERS
   ------------------------------------------------------------------------- */

function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Open-Meteo returns local time already shifted (timezone=auto) but as a
 *  naive string with no offset. Appending "Z" and always formatting with
 *  timeZone:'UTC' makes JS treat that naive string as the value it actually
 *  is, regardless of the visitor's own browser timezone. */
function parseApiTime(str){
  if (!str) return null;
  const iso = str.length <= 10 ? `${str}T00:00:00Z` : `${str}Z`;
  return new Date(iso);
}

function formatHour(str){
  const d = parseApiTime(str);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'UTC' });
}

function formatClock(str){
  const d = parseApiTime(str);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

function formatWeekday(str, index){
  if (index === 0) return 'Today';
  const d = parseApiTime(str);
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function formatDayDate(str){
  const d = parseApiTime(str);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function cToF(c){ return c * 9 / 5 + 32; }

function displayTemp(celsius){
  const v = state.unit === 'fahrenheit' ? cToF(celsius) : celsius;
  return Math.round(v);
}

function unitSymbol(){ return state.unit === 'fahrenheit' ? '°F' : '°C'; }

function degToCompass(deg){
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** Turns a millisecond duration into a short "4h 12m" / "45m" label,
 *  used by the sunrise/sunset status line. */
function formatDuration(ms){
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function uvLabelFor(uv){
  if (uv == null) return '--';
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

function weatherMeta(code){
  return WEATHER_CODES[code] || WEATHER_CODES[0];
}

/** Identifies a plausible, data-supported reason the "feels like" temperature
 *  differs from the actual temperature. Only returns a cause when the
 *  underlying data clearly supports it (humidity for a warmer feel, wind for
 *  a colder feel) — otherwise returns null rather than guessing. Shared by
 *  the hero's explanation line and the Weather Story so both stay consistent. */
function feelsLikeCause(cur){
  if (!cur || cur.apparent_temperature == null) return null;
  const diff = cur.apparent_temperature - cur.temperature_2m;
  if (Math.abs(diff) < 2) return null;
  if (diff > 0 && cur.relative_humidity_2m >= 60) return { direction: 'warmer', cause: 'humidity' };
  if (diff < 0 && cur.wind_speed_10m >= 15) return { direction: 'colder', cause: 'wind' };
  return null;
}

/** Short, human phrase describing the general sky condition — used inside
 *  the Weather Story sentence rather than the more clinical WEATHER_CODES text. */
function conditionPhraseFor(theme, isDay){
  switch (theme){
    case 'clear':  return isDay ? 'clear skies' : 'a clear sky';
    case 'cloudy': return 'cloudy skies';
    case 'rain':   return 'rain in the area';
    case 'snow':   return 'snow falling';
    case 'fog':    return 'foggy conditions';
    case 'storm':  return 'thunderstorms nearby';
    default:       return 'changing skies';
  }
}

/** Picks the accurate noun for precipitation chances — "rain" only when the
 *  condition is clearly rain or a rain-bearing storm, "snow" for snow, and
 *  the generic "precipitation" when the condition is unclear or mixed, so
 *  the app never calls snow or fog "rain" just because a probability exists. */
function precipNounFor(theme){
  if (theme === 'snow') return 'snow';
  if (theme === 'rain' || theme === 'storm') return 'rain';
  return 'precipitation';
}

/** Turns an hours-from-now offset and an API time string into a natural
 *  part-of-day phrase ("this afternoon", "tonight", etc.) instead of a
 *  raw clock time, so the story reads like a sentence rather than a stat. */
function relativeTimeLabel(timeStr, hoursFromNow){
  if (hoursFromNow <= 1) return 'soon';
  const hour = parseApiTime(timeStr).getUTCHours();
  if (hour < 6) return 'overnight';
  if (hour < 12) return 'this morning';
  if (hour < 17) return 'this afternoon';
  if (hour < 21) return 'this evening';
  return 'tonight';
}

/** Builds a short (1-3 sentence) natural-language summary of the current
 *  weather entirely from data already fetched — no extra API calls, no
 *  hard-coded sentence. Combines temperature, humidity, condition, rain
 *  outlook, wind, and UV into a handful of sensible phrase combinations. */
function buildWeatherStory(data){
  try{
    const cur = data.current;
    const hourly = data.hourly;
    if (!cur || !hourly || !hourly.time?.length){
      return 'Weather details are on their way — check back in a moment.';
    }

    const idx = findCurrentHourIndex(hourly, cur.time);
    const meta = weatherMeta(cur.weather_code);
    const isDay = cur.is_day === 1;
    const temp = cur.temperature_2m;
    const feels = cur.apparent_temperature;
    const humidity = cur.relative_humidity_2m;
    const wind = cur.wind_speed_10m;
    const uv = hourly.uv_index?.[idx];

    const sentences = [];

    // ---- opening: temperature + humidity + condition ----
    let tempWord;
    if (temp >= 32) tempWord = 'hot';
    else if (temp >= 24) tempWord = 'warm';
    else if (temp >= 16) tempWord = 'mild';
    else if (temp >= 8) tempWord = 'cool';
    else tempWord = 'cold';

    let feelsClause = '';
    const cause = feelsLikeCause(cur);
    if (cause){
      feelsClause = cause.cause === 'humidity'
        ? ', and humidity is making it feel warmer'
        : ', though wind is making it feel colder';
    } else if (feels != null){
      const diff = feels - temp;
      if (diff <= -3) feelsClause = ', though it feels noticeably cooler than that';
      else if (diff >= 3) feelsClause = ', and it feels warmer than the actual temperature';
    }

    let humidityWord = '';
    if (humidity != null){
      if (humidity >= 75) humidityWord = ' and humid';
      else if (humidity <= 25) humidityWord = ' and dry';
    }

    const conditionPhrase = conditionPhraseFor(meta.theme, isDay);
    sentences.push(
      `It's ${tempWord}${humidityWord} ${isDay ? 'today' : 'tonight'}${feelsClause}, with ${conditionPhrase}.`
    );

    // ---- precipitation outlook, looking at the next several hours ----
    const lookaheadHours = 8;
    const probs = hourly.precipitation_probability?.slice(idx, idx + lookaheadHours) || [];
    const times = hourly.time?.slice(idx, idx + lookaheadHours) || [];
    const codes = hourly.weather_code?.slice(idx, idx + lookaheadHours) || [];
    let maxProb = -1, maxAt = 0;
    probs.forEach((p, i) => { if (p != null && p > maxProb){ maxProb = p; maxAt = i; } });
    const precipNoun = precipNounFor(weatherMeta(codes[maxAt]).theme);

    if (maxProb >= 60){
      const when = relativeTimeLabel(times[maxAt], maxAt);
      const advice = precipNoun === 'snow'
        ? 'so travel could be slower than usual'
        : precipNoun === 'rain'
          ? 'so it might be worth carrying an umbrella'
          : 'so it is worth keeping an eye on the forecast';
      sentences.push(`There's a high chance of ${precipNoun} ${when}, ${advice}.`);
    } else if (maxProb >= 30){
      const when = relativeTimeLabel(times[maxAt], maxAt);
      const noun = precipNoun === 'snow' ? 'Snow' : precipNoun === 'rain' ? 'Rain' : 'Precipitation';
      sentences.push(`${noun} is possible ${when}.`);
    } else if (probs.length && (meta.theme === 'clear' || meta.theme === 'cloudy')){
      sentences.push('No precipitation is expected for the next several hours.');
    }

    // ---- one advisory, wind takes priority over UV ----
    if (wind >= 30){
      sentences.push('Winds are quite strong, so secure loose items outdoors.');
    } else if (isDay && uv != null && uv >= 8){
      sentences.push('UV levels are very high — sun protection is recommended.');
    } else if (isDay && uv != null && uv >= 6 && sentences.length < 3){
      sentences.push('UV levels are high, so sunscreen is a good idea.');
    }

    return sentences.slice(0, 3).join(' ');
  }catch(e){
    // Never let a story-generation edge case break the rest of the app.
    return 'Weather details are on their way — check back in a moment.';
  }
}

function showOnly(sectionEl){
  [el.emptyState, el.loadingState, el.errorState, el.weatherView].forEach(s => {
    s.hidden = s !== sectionEl;
  });
}

/* -------------------------------------------------------------------------
   6. API LAYER
   ------------------------------------------------------------------------- */

async function fetchJson(url){
  let res;
  try{
    res = await fetch(url);
  }catch(networkErr){
    throw new Error('NETWORK');
  }
  if (!res.ok){
    throw new Error('API');
  }
  return res.json();
}

async function searchCities(query){
  const url = `${CONFIG.GEOCODE_URL}?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
  const data = await fetchJson(url);
  return data.results || [];
}

async function reverseGeocode(lat, lon){
  try{
    const url = `${CONFIG.REVERSE_GEOCODE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const data = await fetchJson(url);
    return {
      name: data.city || data.locality || data.principalSubdivision || 'Your location',
      country: data.countryName || '',
      admin1: data.principalSubdivision || '',
      latitude: lat,
      longitude: lon,
    };
  }catch(e){
    // Reverse geocoding is a nicety, not a requirement — fall back gracefully.
    return { name: 'Your location', country: '', admin1: '', latitude: lat, longitude: lon };
  }
}

async function fetchWeather(latitude, longitude){
  const params = new URLSearchParams({
    latitude, longitude,
    current: [
      'temperature_2m','relative_humidity_2m','apparent_temperature','is_day',
      'precipitation','weather_code','wind_speed_10m','wind_direction_10m','pressure_msl'
    ].join(','),
    hourly: [
      'temperature_2m','precipitation_probability','precipitation','weather_code','visibility','uv_index','wind_speed_10m'
    ].join(','),
    daily: [
      'weather_code','temperature_2m_max','temperature_2m_min','sunrise','sunset',
      'precipitation_probability_max','uv_index_max'
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
  });
  const url = `${CONFIG.FORECAST_URL}?${params.toString()}`;
  return fetchJson(url);
}

/* -------------------------------------------------------------------------
   FAVORITE CITIES — persisted with localStorage, no account/backend needed
   ------------------------------------------------------------------------- */

function loadFavorites(){
  try{
    const raw = localStorage.getItem('weather_favorites');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }catch(e){
    // Corrupted or inaccessible storage shouldn't break the app.
    return [];
  }
}

function saveFavorites(list){
  try{
    localStorage.setItem('weather_favorites', JSON.stringify(list));
  }catch(e){
    // Storage full or unavailable (e.g. private browsing) — fail silently;
    // favorites just won't persist for this session.
  }
}

function samePlace(a, b){
  if (!a || !b) return false;
  return Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;
}

function isFavorite(place){
  return state.favorites.some(f => samePlace(f, place));
}

function renderFavorites(){
  el.favoritesBar.hidden = state.favorites.length === 0;
  el.favoritesList.innerHTML = '';
  state.favorites.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'favorite-chip';
    chip.setAttribute('role', 'listitem');
    chip.innerHTML = `
      <button class="favorite-chip__main" type="button" data-index="${i}">
        <span class="favorite-chip__heart" aria-hidden="true">❤</span>
        <span class="favorite-chip__name">${f.name}</span>
      </button>
      <button class="favorite-chip__remove" type="button" data-index="${i}" aria-label="Remove ${f.name} from favorites">×</button>
    `;
    el.favoritesList.appendChild(chip);
  });
}

function updateFavoriteToggleUI(place){
  const active = isFavorite(place);
  el.favoriteToggle.classList.toggle('is-active', active);
  el.favoriteToggle.setAttribute('aria-pressed', String(active));
  el.favoriteToggle.setAttribute('aria-label', active ? 'Remove from favorites' : 'Add to favorites');
}

function toggleFavorite(place){
  if (!place) return;
  if (isFavorite(place)){
    state.favorites = state.favorites.filter(f => !samePlace(f, place));
  } else {
    state.favorites = [...state.favorites, place];
  }
  saveFavorites(state.favorites);
  renderFavorites();
  updateFavoriteToggleUI(place);
}

function removeFavoriteAt(index){
  state.favorites.splice(index, 1);
  saveFavorites(state.favorites);
  renderFavorites();
  if (state.lastPlace) updateFavoriteToggleUI(state.lastPlace);
}

/* -------------------------------------------------------------------------
   7. RENDERING
   ------------------------------------------------------------------------- */

function findCurrentHourIndex(hourly, currentTimeStr){
  let idx = hourly.time.indexOf(currentTimeStr);
  if (idx !== -1) return idx;
  // Fallback: nearest hour at or before now.
  const now = parseApiTime(currentTimeStr).getTime();
  let best = 0, bestDiff = Infinity;
  hourly.time.forEach((t, i) => {
    const diff = now - parseApiTime(t).getTime();
    if (diff >= 0 && diff < bestDiff){ bestDiff = diff; best = i; }
  });
  return best;
}

function renderCurrent(data, place){
  const cur = data.current;
  const meta = weatherMeta(cur.weather_code);

  el.cityName.textContent = place.name;
  el.countryName.textContent = [place.admin1, place.country].filter(Boolean).join(', ') || '—';

  el.currentTemp.textContent = displayTemp(cur.temperature_2m);
  el.currentTempUnit.textContent = unitSymbol();
  el.currentCondition.textContent = meta.text;
  el.feelsLikeTemp.textContent = `${displayTemp(cur.apparent_temperature)}${unitSymbol()}`;
  el.currentIcon.innerHTML = iconMarkup(meta.icon);

  const feelsCause = feelsLikeCause(cur);
  if (feelsCause){
    el.feelsLikeNote.textContent = feelsCause.cause === 'humidity'
      ? 'Humidity is making it feel warmer.'
      : 'Wind is making it feel colder.';
    el.feelsLikeNote.hidden = false;
  } else {
    el.feelsLikeNote.textContent = '';
    el.feelsLikeNote.hidden = true;
  }

  el.humidityValue.textContent = `${Math.round(cur.relative_humidity_2m)}%`;
  el.windValue.innerHTML = `${Math.round(cur.wind_speed_10m)} <small>km/h</small>`;
  el.windDirection.textContent = `${degToCompass(cur.wind_direction_10m)} · ${Math.round(cur.wind_direction_10m)}°`;
  el.pressureValue.innerHTML = `${Math.round(cur.pressure_msl)} <small>hPa</small>`;

  const idx = findCurrentHourIndex(data.hourly, cur.time);
  const visKm = data.hourly.visibility?.[idx];
  if (visKm != null){
    const km = visKm / 1000;
    el.visibilityValue.innerHTML = `${km >= 10 ? Math.round(km) : km.toFixed(1)} <small>km</small>`;
  } else {
    el.visibilityValue.innerHTML = `-- <small>km</small>`;
  }

  const uv = data.hourly.uv_index?.[idx];
  el.uvValue.textContent = uv != null ? uv.toFixed(1) : '--';
  el.uvLabel.textContent = uvLabelFor(uv);

  const precipProb = data.hourly.precipitation_probability?.[idx];
  el.precipValue.textContent = precipProb != null ? `${precipProb}%` : '--';

  return { meta, isDay: cur.is_day === 1, currentHourIndex: idx };
}

function renderHourlyAndGraph(data, currentHourIndex){
  const hourly = data.hourly;
  const start = currentHourIndex;
  const end = Math.min(start + CONFIG.HOURLY_HOURS, hourly.time.length);
  const slice = {
    time: hourly.time.slice(start, end),
    temp: hourly.temperature_2m.slice(start, end),
    prob: hourly.precipitation_probability.slice(start, end),
    code: hourly.weather_code.slice(start, end),
  };

  // ---- hourly cards ----
  el.hourlyScroll.innerHTML = '';
  slice.time.forEach((t, i) => {
    const meta = weatherMeta(slice.code[i]);
    const card = document.createElement('div');
    card.className = 'hour-card' + (i === 0 ? ' is-now' : '');
    card.innerHTML = `
      <span class="hour-card__time">${i === 0 ? 'Now' : formatHour(t)}</span>
      <span class="hour-card__icon">${iconMarkup(meta.icon)}</span>
      <span class="hour-card__temp">${displayTemp(slice.temp[i])}°</span>
      <span class="hour-card__precip">${slice.prob[i]}%</span>
    `;
    el.hourlyScroll.appendChild(card);
  });

  // ---- graph: a horizon-line style area/line chart over the same hours ----
  const W = 1000, H = 160, PAD = 14;
  const temps = slice.temp;
  const min = Math.min(...temps), max = Math.max(...temps);
  const range = (max - min) || 1;
  const stepX = (W - PAD * 2) / (temps.length - 1 || 1);

  const points = temps.map((t, i) => {
    const x = PAD + i * stepX;
    const y = PAD + (H - PAD * 2) * (1 - (t - min) / range);
    return [x, y];
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${H} L${points[0][0].toFixed(1)},${H} Z`;

  el.graphLine.setAttribute('d', linePath);
  el.graphFill.setAttribute('d', fillPath);
  el.graphFill.style.fill = 'var(--accent)';

  el.graphDots.innerHTML = '';
  // Only show dots at every 3rd point on small screens' worth of hours to stay uncluttered
  points.forEach((p, i) => {
    if (i % 3 !== 0 && i !== points.length - 1) return;
    const dot = document.createElement('div');
    dot.className = 'graph__dot';
    dot.style.left = `${(p[0] / W) * 100}%`;
    dot.style.top = `${(p[1] / H) * 100}%`;
    dot.title = `${formatHour(slice.time[i])}: ${displayTemp(temps[i])}°`;
    el.graphDots.appendChild(dot);
  });
}

function renderDaily(data){
  el.dailyList.innerHTML = '';
  const daily = data.daily;
  daily.time.forEach((t, i) => {
    const meta = weatherMeta(daily.weather_code[i]);
    const li = document.createElement('li');
    li.className = 'day-row';
    li.innerHTML = `
      <span class="day-row__name">${formatWeekday(t, i)}<small>${formatDayDate(t)}</small></span>
      <span class="day-row__icon">${iconMarkup(meta.icon)}</span>
      <span class="day-row__cond">${meta.text}<span class="day-row__rain">${daily.precipitation_probability_max[i] ?? 0}%</span></span>
      <span class="day-row__temps">
        <span class="day-row__hi">${displayTemp(daily.temperature_2m_max[i])}°</span>
        <span class="day-row__lo">${displayTemp(daily.temperature_2m_min[i])}°</span>
      </span>
    `;
    el.dailyList.appendChild(li);
  });
}

function renderSunArc(data){
  const daily = data.daily;
  const sunrise = daily.sunrise?.[0];
  const sunset = daily.sunset?.[0];

  // Guard against a response that's missing sunrise/sunset (can happen for
  // some polar locations or a partial API payload) so we degrade gracefully
  // instead of rendering NaN positions.
  if (!sunrise || !sunset){
    el.sunriseTime.textContent = '--:--';
    el.sunsetTime.textContent = '--:--';
    el.sunDot.style.opacity = '0.25';
    el.sunStatus.textContent = '';
    return;
  }

  el.sunriseTime.textContent = formatClock(sunrise);
  el.sunsetTime.textContent = formatClock(sunset);

  const now = parseApiTime(data.current.time).getTime();
  const sr = parseApiTime(sunrise).getTime();
  const ss = parseApiTime(sunset).getTime();

  if (!Number.isFinite(sr) || !Number.isFinite(ss) || ss === sr){
    el.sunDot.style.opacity = '0.25';
    el.sunStatus.textContent = '';
    return;
  }

  let progress = (now - sr) / (ss - sr);
  progress = Math.max(0, Math.min(1, progress));

  // arc path: M20,140 A130,130 0 0,1 280,140  — approximate position along it
  const angle = Math.PI * (1 - progress); // PI -> 0 as progress goes 0 -> 1
  const cx = 150, cy = 140, r = 130;
  const x = cx - r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  el.sunDot.setAttribute('cx', x.toFixed(1));
  el.sunDot.setAttribute('cy', y.toFixed(1));
  el.sunDot.style.opacity = (now >= sr && now <= ss) ? '1' : '0.25';

  // Status line: how long until sunset (during the day) or sunrise
  // (overnight), using tomorrow's sunrise once today's has already passed.
  if (now < sr){
    el.sunStatus.textContent = `Sunrise in ${formatDuration(sr - now)}`;
  } else if (now <= ss){
    el.sunStatus.textContent = `Sunset in ${formatDuration(ss - now)}`;
  } else {
    const nextSunrise = daily.sunrise?.[1];
    if (nextSunrise){
      const nsr = parseApiTime(nextSunrise).getTime();
      el.sunStatus.textContent = `Sunrise in ${formatDuration(nsr - now)}`;
    } else {
      el.sunStatus.textContent = 'Night';
    }
  }
}

/* -------------------------------------------------------------------------
   8. SKY / BACKGROUND THEMING
   ------------------------------------------------------------------------- */

function applySkyTheme(themeKey, isDay){
  const key = `${themeKey}_${isDay ? 'day' : 'night'}`;
  const theme = SKY_THEMES[key] || SKY_THEMES.clear_day;
  const root = document.documentElement.style;
  root.setProperty('--sky-top', theme.top);
  root.setProperty('--sky-mid', theme.mid);
  root.setProperty('--sky-bottom', theme.bottom);
  root.setProperty('--horizon-fill', theme.horizon);
  root.setProperty('--accent', theme.accent);

  el.sky.classList.toggle('sky--day', isDay);
  el.sky.classList.toggle('sky--night', !isDay);
  el.sky.classList.remove('sky--clear','sky--cloudy','sky--rain','sky--snow','sky--fog','sky--storm');
  el.sky.classList.add(`sky--${themeKey}`);

  renderPrecipParticles(themeKey);
}

function renderPrecipParticles(themeKey){
  if (state.precipParticlesTheme === themeKey) return;
  state.precipParticlesTheme = themeKey;
  el.precip.innerHTML = '';

  if (themeKey === 'rain' || themeKey === 'storm'){
    const count = themeKey === 'storm' ? 40 : 28;
    for (let i = 0; i < count; i++){
      const drop = document.createElement('span');
      drop.className = 'drop';
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.animationDuration = `${0.5 + Math.random() * 0.4}s`;
      drop.style.animationDelay = `${Math.random() * 1}s`;
      drop.style.opacity = `${0.3 + Math.random() * 0.4}`;
      el.precip.appendChild(drop);
    }
  } else if (themeKey === 'snow'){
    for (let i = 0; i < 26; i++){
      const flake = document.createElement('span');
      flake.className = 'flake';
      const size = 2 + Math.random() * 3;
      flake.style.width = `${size}px`;
      flake.style.height = `${size}px`;
      flake.style.left = `${Math.random() * 100}%`;
      flake.style.animationDuration = `${8 + Math.random() * 6}s`;
      flake.style.animationDelay = `${Math.random() * 6}s`;
      flake.style.opacity = `${0.4 + Math.random() * 0.5}`;
      el.precip.appendChild(flake);
    }
  }
}

/* -------------------------------------------------------------------------
   Weather Story + Precipitation Timeline rendering
   ------------------------------------------------------------------------- */

function renderWeatherStory(data){
  el.storyText.textContent = buildWeatherStory(data);
}

/** Maps a weather theme to the color used in the Precipitation Timeline, so a
 *  snowy or clear hour is never visually colored to look like rain. */
function precipColorFor(theme){
  switch (theme){
    case 'snow':   return '#EAF3FA';
    case 'storm':  return '#B9A6E8';
    case 'rain':   return '#7EC8E3';
    case 'fog':    return '#C7CCD3';
    case 'cloudy': return '#9FB0C9';
    default:       return '#7EC8E3';
  }
}

function renderPrecipitationTimeline(data, currentHourIndex){
  const hourly = data.hourly;
  const start = currentHourIndex;
  const end = Math.min(start + CONFIG.RAIN_HOURS, hourly.time.length);

  const time = hourly.time.slice(start, end);
  const prob = hourly.precipitation_probability?.slice(start, end) || [];
  // Precipitation amount (mm) is a bonus indicator — if it's ever missing
  // from the response, fall back to probability alone rather than breaking.
  const amount = hourly.precipitation?.slice(start, end) || [];
  const code = hourly.weather_code?.slice(start, end) || [];

  el.precipTimeline.innerHTML = '';
  time.forEach((t, i) => {
    const p = prob[i] ?? 0;
    const mm = amount[i];
    const meta = weatherMeta(code[i]);
    const color = precipColorFor(meta.theme);
    const mmLabel = (mm != null && mm >= 0.1) ? `${mm.toFixed(1)}mm` : '';
    const fillOpacity = (0.25 + (Math.min(p, 100) / 100) * 0.75).toFixed(2);

    const bar = document.createElement('div');
    bar.className = 'precip-bar' + (i === 0 ? ' is-now' : '');
    const noun = precipNounFor(meta.theme);
    bar.title = `${i === 0 ? 'Now' : formatHour(t)}: ${p}% chance of ${noun}${mmLabel ? `, ${mmLabel}` : ''}`;
    bar.innerHTML = `
      <span class="precip-bar__prob" style="color:${color}">${p}%</span>
      <div class="precip-bar__track">
        <div class="precip-bar__fill" style="height:${Math.max(p, 4)}%; opacity:${fillOpacity}; background:${color}"></div>
      </div>
      <span class="precip-bar__icon" style="color:${color}">${iconMarkup(meta.icon)}</span>
      <span class="precip-bar__time">${i === 0 ? 'Now' : formatHour(t)}</span>
      ${mmLabel ? `<span class="precip-bar__mm">${mmLabel}</span>` : ''}
    `;
    el.precipTimeline.appendChild(bar);
  });
}

/* -------------------------------------------------------------------------
   What should I wear? — deterministic, rule-based outfit suggestions
   ------------------------------------------------------------------------- */

/** Builds a short, capped list of outfit suggestions from current-conditions
 *  data already fetched — no extra API calls, no AI. Priority order: a base
 *  clothing layer (from feels-like temperature), then footwear/umbrella
 *  (from near-term rain outlook), then wind, then sun protection. */
function buildOutfitRecommendations(data, currentHourIndex){
  try{
    const cur = data.current;
    const hourly = data.hourly;
    if (!cur){
      return ['👕 Check back once weather data finishes loading.'];
    }

    const feels = cur.apparent_temperature ?? cur.temperature_2m;
    const wind = cur.wind_speed_10m;
    const isDay = cur.is_day === 1;
    const uv = hourly?.uv_index?.[currentHourIndex];

    const items = [];

    // ---- base layer, driven by how it actually feels outside ----
    if (feels < 0) items.push('🧥 Heavy jacket and warm layers recommended');
    else if (feels < 8) items.push('🧥 Warm jacket recommended');
    else if (feels < 16) items.push('🧥 Light jacket recommended');
    else if (feels < 24) items.push('👕 Comfortable clothing should be fine');
    else if (feels < 32) items.push('👕 Light clothing recommended');
    else items.push('👕 Light, breathable clothing recommended');

    // ---- footwear / precipitation gear, from the next few hours of forecast ----
    const probs = hourly?.precipitation_probability?.slice(currentHourIndex, currentHourIndex + 6) || [];
    const codes = hourly?.weather_code?.slice(currentHourIndex, currentHourIndex + 6) || [];
    const validProbs = probs.filter(p => p != null);
    const maxProb = validProbs.length ? Math.max(...validProbs) : (cur.precipitation > 0 ? 80 : 0);
    const maxProbIdx = validProbs.length ? probs.indexOf(Math.max(...validProbs)) : 0;
    const precipNoun = precipNounFor(weatherMeta(codes[maxProbIdx] ?? cur.weather_code).theme);

    if (maxProb >= 50){
      if (precipNoun === 'snow'){
        items.push('🥾 Waterproof boots recommended');
        items.push('❄️ Dress for snowy, slippery conditions');
      } else {
        items.push('☂️ Bring an umbrella');
        items.push('👢 Water-resistant shoes recommended');
      }
    } else if (maxProb >= 25){
      items.push(precipNoun === 'snow' ? '❄️ Light snow possible — dress accordingly' : '☔ An umbrella might be handy');
    } else {
      items.push('👟 Sneakers should be fine');
    }

    // ---- wind, phrased more urgently when it's also cold (wind-resistant layer matters more) ----
    if (wind >= 30){
      items.push(feels < 8
        ? '🧣 Strong, cold wind — a wind-resistant layer is important'
        : '🧣 Strong wind — a windbreaker or light outer layer helps');
    }

    // ---- sun protection ----
    if (isDay && uv != null && uv >= 6){
      items.push('🕶️ Sunglasses and sun protection recommended');
    }

    return items.slice(0, 4);
  }catch(e){
    return ['👕 Check back once weather data finishes loading.'];
  }
}

function renderOutfitRecommendations(data, currentHourIndex){
  const items = buildOutfitRecommendations(data, currentHourIndex);
  el.outfitList.innerHTML = items.map(item => {
    const [emoji, ...rest] = item.split(' ');
    return `<li><span class="outfit-emoji" aria-hidden="true">${emoji}</span><span>${rest.join(' ')}</span></li>`;
  }).join('');
}

/* -------------------------------------------------------------------------
   Best time to go outside — scans the upcoming hourly data for the most
   comfortable contiguous window (temperature + rain chance + wind).
   ------------------------------------------------------------------------- */

function findBestOutdoorWindow(data, currentHourIndex){
  const hourly = data.hourly;
  if (!hourly || !hourly.time?.length){
    return { ok: false, text: 'Not enough data to suggest a good time to go outside.' };
  }

  const horizon = 14; // look ahead roughly half a day
  const end = Math.min(currentHourIndex + horizon, hourly.time.length);
  const hours = [];
  for (let i = currentHourIndex; i < end; i++){
    const temp = hourly.temperature_2m?.[i];
    const prob = hourly.precipitation_probability?.[i] ?? 0;
    const wind = hourly.wind_speed_10m?.[i] ?? 0;
    const theme = weatherMeta(hourly.weather_code?.[i]).theme;
    if (temp == null) continue;

    // Comfortable band is roughly 16-28°C; a penalty grows the further outside it we go.
    const tempPenalty = (temp >= 16 && temp <= 28) ? 0 : Math.min(Math.abs(temp - 22), 20);
    const rainPenalty = prob * 0.6;
    // Comfortable wind adds nothing; it climbs steadily past ~15 km/h and
    // becomes a significant penalty once it's genuinely strong (~45+ km/h).
    const windPenalty = wind <= 15 ? 0 : Math.min((wind - 15) * 0.8, 25);

    hours.push({ i, time: hourly.time[i], temp, prob, wind, theme, score: tempPenalty + rainPenalty + windPenalty });
  }

  if (!hours.length){
    return { ok: false, text: 'Not enough data to suggest a good time to go outside.' };
  }

  // Find the lowest-scoring contiguous window of 2-4 hours, ruling out
  // anything with a high rain chance, very strong wind, or a thunderstorm
  // even if the averaged score looks fine.
  let best = null;
  const minLen = 2, maxLen = 4;
  for (let start = 0; start < hours.length; start++){
    for (let len = minLen; len <= Math.min(maxLen, hours.length - start); len++){
      const slice = hours.slice(start, start + len);
      const avg = slice.reduce((s, h) => s + h.score, 0) / slice.length;
      const maxRain = Math.max(...slice.map(h => h.prob));
      const maxWind = Math.max(...slice.map(h => h.wind));
      const hasStorm = slice.some(h => h.theme === 'storm');
      if (maxRain > 60 || maxWind > 45 || hasStorm) continue;
      if (!best || avg < best.avg){
        best = { avg, slice };
      }
    }
  }

  if (!best || best.avg > 18){
    const avgRainAll = hours.reduce((s, h) => s + h.prob, 0) / hours.length;
    const avgTempAll = hours.reduce((s, h) => s + h.temp, 0) / hours.length;
    const avgWindAll = hours.reduce((s, h) => s + h.wind, 0) / hours.length;
    let reason;
    if (avgRainAll >= 50) reason = 'rain chances remain high throughout the day';
    else if (avgWindAll >= 35) reason = 'winds stay too strong throughout the day';
    else if (avgTempAll >= 32) reason = 'temperatures stay uncomfortably hot throughout';
    else if (avgTempAll <= 2) reason = 'temperatures stay uncomfortably cold throughout';
    else reason = 'conditions remain unsettled throughout the day';
    return { ok: false, text: `No ideal window today — ${reason}.` };
  }

  const slice = best.slice;
  const startLabel = formatHour(slice[0].time);
  const afterLastIdx = Math.min(slice[slice.length - 1].i + 1, hourly.time.length - 1);
  const endLabel = formatHour(hourly.time[afterLastIdx]);

  const avgProb = Math.round(slice.reduce((s, h) => s + h.prob, 0) / slice.length);
  const avgWind = Math.round(slice.reduce((s, h) => s + h.wind, 0) / slice.length);
  const temps = slice.map(h => displayTemp(h.temp));
  const minT = Math.min(...temps), maxT = Math.max(...temps);
  const tempRange = minT === maxT ? `${minT}${unitSymbol()}` : `${minT}–${maxT}${unitSymbol()}`;

  // Use the condition at the hour with the highest rain chance in the window
  // to describe it accurately (rain vs. snow vs. generic precipitation).
  const wettestHour = slice.reduce((a, b) => (b.prob > a.prob ? b : a), slice[0]);
  const noun = precipNounFor(wettestHour.theme);
  const nounLabel = noun === 'snow' ? 'snow' : noun === 'rain' ? 'rain' : 'precipitation';
  const rainPhrase = avgProb <= 20 ? `Low chance of ${nounLabel}` : `Manageable chance of ${nounLabel}`;
  const windNote = avgWind >= 20 ? ` and a noticeable breeze (~${avgWind} km/h)` : '';

  return {
    ok: true,
    startLabel, endLabel,
    detail: `${rainPhrase} (${avgProb}%) with comfortable temperatures around ${tempRange}${windNote}.`,
  };
}

function renderBestTimeOut(data, currentHourIndex){
  const result = findBestOutdoorWindow(data, currentHourIndex);
  if (result.ok){
    el.bestTimeRange.hidden = false;
    el.bestTimeRange.textContent = `${result.startLabel} – ${result.endLabel}`;
    el.bestTimeDetail.textContent = result.detail;
  } else {
    el.bestTimeRange.hidden = true;
    el.bestTimeRange.textContent = '';
    el.bestTimeDetail.textContent = result.text;
  }
}

/* -------------------------------------------------------------------------
   Compare Cities — a second city's live data placed alongside the primary
   one. The primary side reuses state.weatherData (already fetched); only
   the comparison city needs its own request, and it's cached so switching
   the primary city later doesn't re-fetch it unnecessarily.
   ------------------------------------------------------------------------- */

function compareColumnHtml(place, data){
  const cur = data.current;
  const meta = weatherMeta(cur.weather_code);
  const idx = findCurrentHourIndex(data.hourly, cur.time);
  const rainProb = data.hourly.precipitation_probability?.[idx];
  const uv = data.hourly.uv_index?.[idx];

  return `
    <div class="compare__col">
      <h3 class="compare__city">${place.name}</h3>
      <div class="compare__icon">${iconMarkup(meta.icon)}</div>
      <div class="compare__temp">${displayTemp(cur.temperature_2m)}°</div>
      <div class="compare__row"><span>Feels like</span><span>${displayTemp(cur.apparent_temperature)}°</span></div>
      <div class="compare__row"><span>Condition</span><span>${meta.text}</span></div>
      <div class="compare__row"><span>Rain</span><span>${rainProb != null ? rainProb + '%' : '--'}</span></div>
      <div class="compare__row"><span>Humidity</span><span>${Math.round(cur.relative_humidity_2m)}%</span></div>
      <div class="compare__row"><span>Wind</span><span>${Math.round(cur.wind_speed_10m)} km/h</span></div>
      <div class="compare__row"><span>UV</span><span>${uv != null ? uv.toFixed(1) : '--'}</span></div>
    </div>
  `;
}

function renderComparison(){
  const ready = state.compareCity && state.compareData && state.weatherData && state.lastPlace;
  if (!ready){
    el.compareGrid.hidden = true;
    el.compareGrid.innerHTML = '';
    el.compareEmpty.hidden = false;
    el.compareEmpty.textContent = state.compareCity
      ? 'Comparison will appear once both cities have loaded.'
      : 'Search a city above to compare it with your current weather.';
    return;
  }
  el.compareEmpty.hidden = true;
  el.compareGrid.hidden = false;
  el.compareGrid.innerHTML =
    compareColumnHtml(state.lastPlace, state.weatherData) +
    compareColumnHtml(state.compareCity, state.compareData);
}

async function setComparisonCity(place){
  state.compareCity = place;
  state.compareData = null;
  el.compareClear.hidden = false;
  el.compareEmpty.hidden = true;
  el.compareGrid.hidden = false;
  el.compareGrid.innerHTML = '<p class="compare__loading">Loading…</p>';
  try{
    const data = await fetchWeather(place.latitude, place.longitude);
    state.compareData = data;
    renderComparison();
  }catch(e){
    el.compareGrid.innerHTML = '<p class="compare__loading">Could not load that city. Please try again.</p>';
  }
}

function clearComparison(){
  state.compareCity = null;
  state.compareData = null;
  el.compareClear.hidden = true;
  el.compareInput.value = '';
  renderComparison();
}

/* -------------------------------------------------------------------------
   MAIN ORCHESTRATION — load a place end to end
   ------------------------------------------------------------------------- */

async function loadPlace(place){
  showOnly(el.loadingState);
  try{
    const data = await fetchWeather(place.latitude, place.longitude);
    state.weatherData = data;
    state.lastPlace = place;

    const { meta, isDay, currentHourIndex } = renderCurrent(data, place);
    renderHourlyAndGraph(data, currentHourIndex);
    renderDaily(data);
    renderSunArc(data);
    renderWeatherStory(data);
    renderPrecipitationTimeline(data, currentHourIndex);
    renderOutfitRecommendations(data, currentHourIndex);
    renderBestTimeOut(data, currentHourIndex);
    applySkyTheme(meta.theme, isDay);
    updateFavoriteToggleUI(place);
    renderComparison(); // no-op until a comparison city has been chosen

    localStorage.setItem('weather_last_place', JSON.stringify(place));
    showOnly(el.weatherView);
  }catch(err){
    const isNetwork = err.message === 'NETWORK';
    el.errorTitle.textContent = isNetwork ? 'No connection' : 'Weather unavailable';
    el.errorBody.textContent = isNetwork
      ? 'Check your internet connection and try again.'
      : 'We could not reach the weather service. Please try again in a moment.';
    showOnly(el.errorState);
  }
}

/* -------------------------------------------------------------------------
   9. EVENT WIRING — search
   ------------------------------------------------------------------------- */

function closeSearchResults(){
  el.searchResults.hidden = true;
  el.searchResults.innerHTML = '';
  el.searchInput.setAttribute('aria-expanded', 'false');
  state.searchFocusIndex = -1;
}

function renderSearchResults(results){
  state.searchResults = results;
  state.searchFocusIndex = -1;

  if (!results.length){
    el.searchResults.innerHTML = `<li class="search__empty">No cities found. Try a different spelling.</li>`;
    el.searchResults.hidden = false;
    el.searchInput.setAttribute('aria-expanded', 'true');
    return;
  }

  el.searchResults.innerHTML = results.map((r, i) => {
    // Disambiguate identically-named cities with admin region + country.
    const sub = [r.admin1, r.country].filter(Boolean).join(', ');
    return `<li class="search__result" role="option" id="result-${i}" data-index="${i}">
      <span class="search__result-name">${r.name}</span>
      <span class="search__result-sub">${sub}</span>
    </li>`;
  }).join('');
  el.searchResults.hidden = false;
  el.searchInput.setAttribute('aria-expanded', 'true');
}

function selectSearchResult(index){
  const r = state.searchResults[index];
  if (!r) return;
  el.searchInput.value = r.name;
  closeSearchResults();
  el.searchClear.hidden = false;
  loadPlace({
    name: r.name, country: r.country || '', admin1: r.admin1 || '',
    latitude: r.latitude, longitude: r.longitude,
  });
}

const debouncedSearch = debounce(async (query) => {
  try{
    const results = await searchCities(query);
    renderSearchResults(results);
  }catch(e){
    el.searchResults.innerHTML = `<li class="search__empty">Search is unavailable right now.</li>`;
    el.searchResults.hidden = false;
  }
}, CONFIG.SEARCH_DEBOUNCE_MS);

el.searchInput.addEventListener('input', () => {
  const q = el.searchInput.value.trim();
  el.searchClear.hidden = q.length === 0;
  if (q.length < 2){ closeSearchResults(); return; }
  debouncedSearch(q);
});

el.searchInput.addEventListener('keydown', (e) => {
  const items = el.searchResults.querySelectorAll('.search__result');
  if (e.key === 'ArrowDown'){
    e.preventDefault();
    if (!items.length) return;
    state.searchFocusIndex = Math.min(state.searchFocusIndex + 1, items.length - 1);
    items.forEach(it => it.classList.remove('is-focused'));
    items[state.searchFocusIndex].classList.add('is-focused');
    items[state.searchFocusIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp'){
    e.preventDefault();
    if (!items.length) return;
    state.searchFocusIndex = Math.max(state.searchFocusIndex - 1, 0);
    items.forEach(it => it.classList.remove('is-focused'));
    items[state.searchFocusIndex].classList.add('is-focused');
    items[state.searchFocusIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Escape'){
    closeSearchResults();
  } else if (e.key === 'Enter'){
    e.preventDefault();
    if (state.searchFocusIndex >= 0){
      selectSearchResult(state.searchFocusIndex);
    } else if (state.searchResults.length){
      selectSearchResult(0);
    } else if (el.searchInput.value.trim().length >= 2){
      // No results fetched yet (e.g. fast Enter) — search then pick first match.
      searchCities(el.searchInput.value.trim()).then(results => {
        renderSearchResults(results);
        if (results.length) selectSearchResult(0);
      }).catch(() => {});
    }
  }
});

el.searchResults.addEventListener('click', (e) => {
  const item = e.target.closest('.search__result');
  if (!item) return;
  selectSearchResult(Number(item.dataset.index));
});

el.searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = el.searchInput.value.trim();
  if (q.length < 2) return;
  searchCities(q).then(results => {
    renderSearchResults(results);
    if (results.length) selectSearchResult(0);
  }).catch(() => {
    el.errorTitle.textContent = 'Search unavailable';
    el.errorBody.textContent = 'We could not search for that city. Please try again.';
    showOnly(el.errorState);
  });
});

el.searchClear.addEventListener('click', () => {
  el.searchInput.value = '';
  el.searchClear.hidden = true;
  closeSearchResults();
  el.searchInput.focus();
});

document.addEventListener('click', (e) => {
  if (!el.searchForm.contains(e.target)) closeSearchResults();
});

/* ---- compare cities search ---- */

function closeCompareResults(){
  el.compareResults.hidden = true;
  el.compareResults.innerHTML = '';
  el.compareInput.setAttribute('aria-expanded', 'false');
}

function renderCompareResults(results){
  state.compareSearchResults = results;
  if (!results.length){
    el.compareResults.innerHTML = `<li class="search__empty">No cities found.</li>`;
    el.compareResults.hidden = false;
    el.compareInput.setAttribute('aria-expanded', 'true');
    return;
  }
  el.compareResults.innerHTML = results.map((r, i) => {
    const sub = [r.admin1, r.country].filter(Boolean).join(', ');
    return `<li class="compare__result" role="option" id="compare-result-${i}" data-index="${i}">
      <span class="compare__result-name">${r.name}</span>
      <span class="compare__result-sub">${sub}</span>
    </li>`;
  }).join('');
  el.compareResults.hidden = false;
  el.compareInput.setAttribute('aria-expanded', 'true');
}

function pickCompareResult(index){
  const r = state.compareSearchResults[index];
  if (!r) return;
  el.compareInput.value = r.name;
  closeCompareResults();
  setComparisonCity({
    name: r.name, country: r.country || '', admin1: r.admin1 || '',
    latitude: r.latitude, longitude: r.longitude,
  });
}

const debouncedCompareSearch = debounce(async (query) => {
  try{
    const results = await searchCities(query);
    renderCompareResults(results);
  }catch(e){
    el.compareResults.innerHTML = `<li class="search__empty">Search is unavailable right now.</li>`;
    el.compareResults.hidden = false;
  }
}, CONFIG.SEARCH_DEBOUNCE_MS);

el.compareInput.addEventListener('input', () => {
  const q = el.compareInput.value.trim();
  if (q.length < 2){ closeCompareResults(); return; }
  debouncedCompareSearch(q);
});

el.compareInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter'){
    e.preventDefault();
    if (state.compareSearchResults.length) pickCompareResult(0);
  } else if (e.key === 'Escape'){
    closeCompareResults();
  }
});

el.compareResults.addEventListener('click', (e) => {
  const item = e.target.closest('.compare__result');
  if (!item) return;
  pickCompareResult(Number(item.dataset.index));
});

el.compareClear.addEventListener('click', clearComparison);

document.addEventListener('click', (e) => {
  if (!el.compareWrap.contains(e.target)){
    closeCompareResults();
  }
});

/* ---- geolocation ---- */

el.locateBtn.addEventListener('click', () => {
  if (!('geolocation' in navigator)){
    el.errorTitle.textContent = 'Location unavailable';
    el.errorBody.textContent = 'Your browser does not support location detection. Please search for a city instead.';
    showOnly(el.errorState);
    return;
  }
  // Geolocation is only available in secure contexts (https, localhost, and
  // most browsers' file:// pages). Fail clearly instead of leaving the
  // button spinning if that's not the case here.
  if (!window.isSecureContext){
    el.errorTitle.textContent = 'Location unavailable';
    el.errorBody.textContent = 'Location detection needs a secure connection. Please search for a city instead.';
    showOnly(el.errorState);
    return;
  }
  el.locateBtn.classList.add('is-active');
  showOnly(el.loadingState);
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const place = await reverseGeocode(latitude, longitude);
      el.searchInput.value = place.name;
      el.locateBtn.classList.remove('is-active');
      loadPlace(place);
    },
    () => {
      el.locateBtn.classList.remove('is-active');
      showOnly(el.emptyState);
      el.emptyState.querySelector('.state__body').textContent =
        'Location permission was denied. Search for a city above to see its weather.';
    },
    { timeout: 8000 }
  );
});

/* ---- favorites ---- */

el.favoriteToggle.addEventListener('click', () => {
  if (!state.lastPlace) return;
  toggleFavorite(state.lastPlace);
});

el.favoritesList.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.favorite-chip__remove');
  if (removeBtn){
    removeFavoriteAt(Number(removeBtn.dataset.index));
    return;
  }
  const mainBtn = e.target.closest('.favorite-chip__main');
  if (mainBtn){
    const place = state.favorites[Number(mainBtn.dataset.index)];
    if (place) loadPlace(place);
  }
});

/* ---- unit toggle ---- */

el.unitToggle.addEventListener('click', () => {
  state.unit = state.unit === 'celsius' ? 'fahrenheit' : 'celsius';
  localStorage.setItem('weather_unit', state.unit);
  el.unitToggle.querySelectorAll('.unit-toggle__option').forEach(opt => {
    opt.classList.toggle('is-active', opt.dataset.unit === state.unit);
  });
  if (state.weatherData && state.lastPlace){
    const { currentHourIndex } = renderCurrent(state.weatherData, state.lastPlace);
    renderHourlyAndGraph(state.weatherData, currentHourIndex);
    renderDaily(state.weatherData);
    renderBestTimeOut(state.weatherData, currentHourIndex);
  }
  renderComparison();
});

/* ---- error retry ---- */

el.errorRetry.addEventListener('click', () => {
  if (state.lastPlace){
    loadPlace(state.lastPlace);
  } else {
    showOnly(el.emptyState);
  }
});

/* -------------------------------------------------------------------------
   10. BOOT SEQUENCE
   ------------------------------------------------------------------------- */

(function boot(){
  // reflect stored unit preference in the toggle UI
  el.unitToggle.querySelectorAll('.unit-toggle__option').forEach(opt => {
    opt.classList.toggle('is-active', opt.dataset.unit === state.unit);
  });

  // restore saved favorite cities, if any
  state.favorites = loadFavorites();
  renderFavorites();

  showOnly(el.emptyState);

  const storedPlace = localStorage.getItem('weather_last_place');

  if ('geolocation' in navigator && window.isSecureContext){
    showOnly(el.loadingState);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const place = await reverseGeocode(latitude, longitude);
        el.searchInput.value = place.name;
        loadPlace(place);
      },
      () => {
        // Permission denied or unavailable — fall back to a previous search,
        // otherwise invite the user to search manually.
        if (storedPlace){
          try{ loadPlace(JSON.parse(storedPlace)); return; }catch(e){ /* ignore */ }
        }
        showOnly(el.emptyState);
      },
      { timeout: 8000 }
    );
  } else if (storedPlace){
    try{ loadPlace(JSON.parse(storedPlace)); }catch(e){ showOnly(el.emptyState); }
  }
})();
