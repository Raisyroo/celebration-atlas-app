import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sharesEventFactoryIdentity } from "../lib/event-factory/identity.ts";

assert.equal(
  sharesEventFactoryIdentity(
    { candidateId: null, eventId: null, eventKey: "armada-fair" },
    { candidateId: "coast-guard-candidate", eventId: null, eventKey: "coast-guard-festival" },
  ),
  false,
  "missing canonical ids must not connect unrelated candidate-only records",
);

assert.equal(
  sharesEventFactoryIdentity(
    { candidateId: "armada-candidate", eventId: null, eventKey: "armada-fair" },
    { candidateId: "armada-candidate", eventId: null, eventKey: null },
  ),
  true,
  "matching candidate ids should connect pre-publication records",
);

assert.equal(
  sharesEventFactoryIdentity(
    { candidateId: null, eventId: "armada-event", eventKey: "armada-fair" },
    { candidateId: null, eventId: "armada-event", eventKey: null },
  ),
  true,
  "matching canonical event ids should connect published records",
);

assert.equal(
  sharesEventFactoryIdentity(
    { candidateId: null, eventId: null, eventKey: "armada-fair" },
    { candidateId: null, eventId: null, eventKey: "armada-fair" },
  ),
  true,
  "matching event keys should connect source packages before canonical publication",
);

assert.equal(
  sharesEventFactoryIdentity(
    { candidateId: "", eventId: "", eventKey: "" },
    { candidateId: "", eventId: "", eventKey: "" },
  ),
  false,
  "empty identifiers must not connect unrelated records",
);

const readinessSource = readFileSync(
  new URL("../lib/event-factory/readiness.ts", import.meta.url),
  "utf8",
);
const identityMatcherUseCount = readinessSource.match(/sharesEventFactoryIdentity/g)?.length ?? 0;
assert.ok(
  identityMatcherUseCount >= 10,
  "Event Factory readiness must use null-safe identity matching across related records",
);
assert.doesNotMatch(
  readinessSource,
  /\.candidate_id === candidateId\s*\|\|\s*[^;\n]*\.event_id === eventId/,
  "Event Factory readiness still contains a null-equal cross-event join",
);

console.log("Event Factory identity validation passed.");
