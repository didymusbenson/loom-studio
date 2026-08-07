import test from "node:test";
import assert from "node:assert/strict";
import { isTrustedLocalRequest } from "../src/local-request.js";

test("accepts the Loom Studio loopback hosts", () => {
  assert.equal(isTrustedLocalRequest({ host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173" }, 4173), true);
  assert.equal(isTrustedLocalRequest({ host: "localhost:4173", origin: "http://localhost:4173" }, 4173), true);
  assert.equal(isTrustedLocalRequest({ host: "localhost:4173" }, 4173), true);
});

test("rejects DNS-rebinding hosts and hostile origins", () => {
  assert.equal(isTrustedLocalRequest({ host: "attacker.example:4173", origin: "http://attacker.example:4173" }, 4173), false);
  assert.equal(isTrustedLocalRequest({ host: "localhost:4173", origin: "http://attacker.example:4173" }, 4173), false);
  assert.equal(isTrustedLocalRequest({ host: "localhost:9999", origin: "http://localhost:9999" }, 4173), false);
  assert.equal(isTrustedLocalRequest({}, 4173), false);
});
