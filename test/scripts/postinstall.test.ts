import { describe, expect, it } from "vitest";
// @ts-expect-error The package lifecycle helper is an ESM JavaScript script exercised directly by npm.
import { getPathReminder } from "../../scripts/postinstall.mjs";

describe("postinstall PATH reminder", () => {
  it("does not warn for local installs", () => {
    expect(
      getPathReminder({
        npmConfigGlobal: undefined,
        npmConfigPrefix: "/Users/example/.npm-global",
        pathValue: "",
        platform: "darwin",
        home: "/Users/example"
      })
    ).toBeNull();
  });

  it("does not warn when the global bin directory is already in PATH", () => {
    expect(
      getPathReminder({
        npmConfigGlobal: "true",
        npmConfigPrefix: "/Users/example/.hermes/node",
        pathValue: "/usr/bin:/Users/example/.hermes/node/bin:/bin",
        platform: "darwin",
        home: "/Users/example"
      })
    ).toBeNull();
  });

  it("warns with zsh guidance when the global bin directory is missing from PATH", () => {
    const reminder = getPathReminder({
      npmConfigGlobal: "true",
      npmConfigPrefix: "/Users/example/.hermes/node",
      pathValue: "/usr/bin:/bin",
      platform: "darwin",
      home: "/Users/example"
    });

    expect(reminder).toContain("daily-brief installed, but npm's global command directory is not in PATH");
    expect(reminder).toContain("/Users/example/.hermes/node/bin");
    expect(reminder).toContain('export PATH="$HOME/.hermes/node/bin:$PATH"');
    expect(reminder).toContain("daily-brief setup");
  });
});
