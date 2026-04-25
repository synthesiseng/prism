import fs from "node:fs";
import path from "node:path";

const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? "src/data/hurdat2-atlantic.json";

if (!sourcePath) {
  throw new Error(
    "Usage: node scripts/build-hurdat2-snapshot.mjs <hurdat2-atlantic.txt> [output.json]"
  );
}

const source = fs.readFileSync(sourcePath, "utf8");
const storms = parseHurdat2(source);
const yearStart = 1980;
const yearEnd = 2025;
const view = { lonMin: -100, lonMax: 5, latMin: 4, latMax: 64 };

// Keep the checked-in example focused: modern storms with tropical-storm-force
// winds and at least one point in the visible Atlantic viewport.
const filtered = storms
  .filter((storm) => storm.year >= yearStart && storm.year <= yearEnd)
  .filter((storm) => storm.maxWindKnots >= 34)
  .filter((storm) =>
    storm.points.some(
      (point) =>
        point.lon >= view.lonMin &&
        point.lon <= view.lonMax &&
        point.lat >= view.latMin &&
        point.lat <= view.latMax
    )
  );

const output = {
  source: {
    name: "NOAA/NHC HURDAT2 Atlantic best-track dataset",
    url: "https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-0227.txt",
    archive: "https://www.nhc.noaa.gov/data/hurdat/",
    snapshot: path.basename(sourcePath)
  },
  filters: {
    yearStart,
    yearEnd,
    minimumMaxWindKnots: 34,
    viewport: view
  },
  meta: {
    basin: "Atlantic Basin",
    yearStart,
    yearEnd,
    storms: filtered.length,
    majorHurricanes: filtered.filter((storm) => storm.maxCategory >= 3).length,
    categoryFive: filtered.filter((storm) => storm.maxCategory === 5).length
  },
  storms: filtered
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${filtered.length} HURDAT2 storms to ${outputPath}`);

function parseHurdat2(text) {
  const storms = [];
  let current = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const fields = line.split(",").map((field) => field.trim());
    if (/^AL\d{6}$/.test(fields[0])) {
      // Header rows look like: AL092011, IRENE, 39,
      // Track rows following the header contain the six-hour best-track samples.
      current = {
        stormId: fields[0],
        name: fields[1],
        expectedPoints: Number(fields[2]),
        rows: []
      };
      storms.push(current);
      continue;
    }

    if (!current) {
      throw new Error(`Track row appeared before a storm header: ${line}`);
    }

    current.rows.push(parsePoint(fields));
  }

  return storms.map((storm, index) => normalizeStorm(storm, index));
}

function parsePoint(fields) {
  // HURDAT2 coordinates are hemisphere-suffixed strings like 15.0N and 59.0W;
  // wind is knots, and pressure is -999 when unavailable.
  const timestamp = toTimestamp(fields[0], fields[1]);
  const windKnots = Number(fields[6]);
  const pressure = Number(fields[7]);

  return {
    timestamp,
    lon: parseCoordinate(fields[5]),
    lat: parseCoordinate(fields[4]),
    windKnots,
    pressureMb: pressure > 0 ? pressure : null,
    cat: categoryForWind(windKnots),
    status: fields[3],
    recordIdentifier: fields[2]
  };
}

function normalizeStorm(storm, index) {
  const points = storm.rows;
  const winds = points.map((point) => point.windKnots);
  const pressures = points
    .map((point) => point.pressureMb)
    .filter((pressure) => pressure !== null);
  const first = points[0];
  const last = points[points.length - 1];

  return {
    id: index,
    stormId: storm.stormId,
    name: storm.name === "UNNAMED" ? storm.stormId : titleCase(storm.name),
    year: Number(storm.stormId.slice(4, 8)),
    maxWindKnots: Math.max(...winds),
    minPressureMb: pressures.length > 0 ? Math.min(...pressures) : null,
    maxCategory: Math.max(...points.map((point) => point.cat)),
    firstTimestamp: first.timestamp,
    lastTimestamp: last.timestamp,
    durationDays: durationDays(first.timestamp, last.timestamp),
    points
  };
}

function toTimestamp(date, time) {
  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const day = date.slice(6, 8);
  const hour = time.slice(0, 2);
  const minute = time.slice(2, 4);
  return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
}

function parseCoordinate(value) {
  const direction = value.at(-1);
  const number = Number.parseFloat(value.slice(0, -1));
  return direction === "S" || direction === "W" ? -number : number;
}

function categoryForWind(windKnots) {
  if (windKnots >= 137) return 5;
  if (windKnots >= 113) return 4;
  if (windKnots >= 96) return 3;
  if (windKnots >= 83) return 2;
  if (windKnots >= 64) return 1;
  return 0;
}

function durationDays(start, end) {
  return Number(((Date.parse(end) - Date.parse(start)) / 86400000).toFixed(1));
}

function titleCase(value) {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
