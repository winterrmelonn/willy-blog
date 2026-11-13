// node --test lib/satToken.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { satGate, satToken } from "./satToken.ts";

// Runs the edge check the way SST's CloudFront Function does: at the top of handler(event)
const gate = (uri: string, cookie?: string) =>
    new Function("event", satGate(satToken("secret")))({ request: { uri, cookies: cookie === undefined ? {} : { sat: { value: cookie } } } });

test("SAT data needs the admin cookie; everything else passes", () => {
    assert.equal(gate("/sat-bank/data/img0.js", satToken("secret")), undefined);
    assert.equal(gate("/sat-bank/data/img0.js")?.statusCode, 403);
    assert.equal(gate("/sat-bank/data/img0.js", satToken("other"))?.statusCode, 403);
    assert.equal(gate("/sat-bank/data/img0.js", "")?.statusCode, 403);
    assert.equal(gate("/blogs"), undefined);
    assert.equal(gate("/sat"), undefined); // the page itself checks the session
});
