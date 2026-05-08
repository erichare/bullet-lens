import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "@/lib/api";

describe("resolveApiUrl", () => {
  it("resolves relative API paths against the configured API base", () => {
    expect(resolveApiUrl("https://api.example.test/", "/grooves")).toBe(
      "https://api.example.test/grooves",
    );
  });

  it("preserves absolute URLs", () => {
    expect(resolveApiUrl("https://api.example.test", "http://other.test/jobs")).toBe(
      "http://other.test/jobs",
    );
  });

  it("uses fallback origin when the configured API base is empty", () => {
    expect(resolveApiUrl("", "/health", "http://localhost:3000")).toBe(
      "http://localhost:3000/health",
    );
  });
});
