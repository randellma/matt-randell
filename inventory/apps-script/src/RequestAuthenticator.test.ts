import { describe, it, expect } from "vitest";
import { authenticate } from "./RequestAuthenticator.js";

describe("RequestAuthenticator", () => {
  const correctSecret = "s3cr3t";

  it("accepts a request carrying the correct secret", () => {
    expect(authenticate({ secret: correctSecret }, correctSecret)).toBe(true);
  });

  it("rejects a request with the wrong secret", () => {
    expect(authenticate({ secret: "wrong" }, correctSecret)).toBe(false);
  });

  it("rejects a request with an empty secret", () => {
    expect(authenticate({ secret: "" }, correctSecret)).toBe(false);
  });

  it("rejects a request with no secret field", () => {
    expect(authenticate({}, correctSecret)).toBe(false);
  });
});
