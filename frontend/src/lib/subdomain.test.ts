import { describe, expect, it } from "vitest";
import { deriveSubdomain } from "@/lib/subdomain";

describe("deriveSubdomain", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(deriveSubdomain("Underground Apparel")).toBe("underground-apparel");
  });

  it("strips diacritics", () => {
    expect(deriveSubdomain("Café André")).toBe("cafe-andre");
  });

  it("collapses non-alnum runs into a single hyphen", () => {
    expect(deriveSubdomain("Foo & Bar @@@ Baz")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing hyphens", () => {
    expect(deriveSubdomain("  hello world  ")).toBe("hello-world");
    expect(deriveSubdomain("---hi---")).toBe("hi");
  });

  it("returns an empty string for input with no slug-safe characters", () => {
    expect(deriveSubdomain("@#$%")).toBe("");
  });

  it("caps length at 63 characters (RFC 1035 subdomain limit)", () => {
    const long = "a".repeat(100);
    expect(deriveSubdomain(long)).toHaveLength(63);
  });

  it("keeps existing digits", () => {
    expect(deriveSubdomain("Brand 2025")).toBe("brand-2025");
  });
});
