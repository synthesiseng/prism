import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const [file, version, source] = process.argv.slice(2);
assert.ok(
  file && version && /^[a-f0-9]{40}$/.test(source ?? ""),
  "Usage: node scripts/assert-native-result.mjs result.json browser-version source-sha"
);
const result = JSON.parse(readFileSync(file, "utf8"));
assert.equal(result.source, source, "source commit");
assert.equal(result.browserVersion, version, "exact browser version");
assert.equal(result.harnessError, undefined, "harness must complete");
assert.equal(result.chromiumSandbox, true, "sandbox enabled");
assert.deepEqual(result.flags, ["--enable-features=CanvasDrawElement"], "browser flags");
assert.equal(result.scenarios?.length, 10, "complete scenario count");

const pixels = { red: [255, 0, 0, 255], blue: [0, 0, 255, 255] };
const configurations = [
  [1, 1, false],
  [2, 1, false],
  [1, 1.5, false],
  [2, 1.5, false],
  [2, 1.5, true]
];
function placement(actual, expected, scale) {
  assert.ok(actual && expected, "placement evidence present");
  assert.ok(
    [actual.x, actual.y, expected.x, expected.y].every(Number.isFinite),
    "finite geometry"
  );
  assert.ok(actual.count > 0, "rendered pixels found");
  assert.ok(
    Math.hypot(actual.x - expected.x, actual.y - expected.y) <= 1.5 * scale,
    "observed placement matches independent fixture expectation"
  );
}

for (const mode of ["raw", "prism"]) {
  for (const [dpr, scale, appTransform] of configurations) {
    const rows = result.scenarios.filter(
      (row) =>
        row.mode === mode &&
        row.dpr === dpr &&
        row.scale === scale &&
        row.appTransform === appTransform
    );
    assert.equal(rows.length, 1, `unique ${mode}/${dpr}/${scale}/${appTransform}`);
    const row = rows[0];
    for (const phase of ["initial", "relocated"]) {
      assert.equal(row[phase]?.status, "painted", `${phase} paint`);
      assert.deepEqual(row[phase].pixels, pixels, `${phase} pixels`);
      assert.equal(row[phase].details.devicePixelRatio, dpr, "observed DPR");
      assert.deepEqual(row[phase].details.errors, [], "no paint errors");
      placement(row[`${phase}ImagePoint`], row[phase].details.expectedButtonPoint, scale);
    }
    assert.equal(row.initialClick, 1, "initial click");
    assert.equal(row.oldPositionClicks, 1, "old position no longer interactive");
    assert.equal(row.newPositionClicks, 2, "relocated click");
    assert.equal(row.inactivePaint?.status, "painted", "inactive pass completed");
    assert.equal(row.inactiveClicks, 2, "inactive surface not interactive");
    assert.deepEqual(row.details?.errors, [], "no final page errors");
    const expectedTransform = appTransform ? "translate(13px, 7px) rotate(8deg)" : "";
    assert.equal(
      row.details?.initialTransform,
      expectedTransform,
      "application transform exercised"
    );
    assert.equal(
      row.details?.transform,
      expectedTransform,
      "application transform preserved"
    );
    assert.equal(row.disposal?.transformPreserved, true, "disposal preserves transform");
    assert.equal(row.geometryPass, true, "geometry summary agrees");
    assert.equal(row.transformPass, true, "transform summary agrees");
  }
}
assert.equal(
  result.ownership?.duplicateElementAccepted,
  false,
  "exclusive element ownership"
);
assert.equal(
  result.ownership?.duplicateCanvasAccepted,
  false,
  "exclusive canvas ownership"
);
for (const [field, message] of [
  ["elementError", "Prism surface element is already owned by an active surface."],
  ["canvasError", "Prism canvas is already owned by an active runtime."]
]) {
  assert.equal(result.ownership?.[field]?.name, "Error", "ownership error type");
  assert.equal(result.ownership?.[field]?.message, message, "ownership refusal cause");
}
assert.equal(result.setupFailures?.length, 3, "complete setup failure coverage");
for (const phase of ["decode", "request", "sample"]) {
  const rows = result.setupFailures.filter((row) => row.phase === phase);
  assert.equal(rows.length, 1, "unique setup failure phase");
  assert.equal(rows[0].result?.status, "setup-error", "setup failure is recorded");
  assert.deepEqual(
    rows[0].result?.error,
    { name: "Error", message: `injected-${phase}` },
    "setup failure preserves cause"
  );
  assert.equal(rows[0].remainingRoots, 0, "setup failure cleans inserted DOM");
  assert.equal(rows[0].result.cleanupError, undefined, "setup cleanup succeeds");
}
assert.equal(result.coalescing?.setup?.status, "painted", "coalescing setup");
assert.deepEqual(
  result.coalescing?.setup?.details?.errors,
  [],
  "no coalescing setup errors"
);
assert.equal(result.coalescing?.result?.status, "painted", "coalesced paint completes");
assert.equal(result.coalescing?.result?.requests, 1, "one coalesced native request");
console.log(
  "PASS source, browser, sandbox, ten pixel/click/geometry/transform scenarios, ownership and coalescing"
);
