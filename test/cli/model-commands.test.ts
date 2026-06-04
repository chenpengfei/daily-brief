import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";

describe("removed model CLI command", () => {
  it("does not expose model configuration as a public command", async () => {
    for (const args of [["model"], ["model", "configure"], ["model", "status"], ["model", "login"], ["model", "logout"]]) {
      await expect(runCli(args, captureOutput([]), {})).rejects.toThrow("Unknown command: model");
    }
  });
});

function captureOutput(output: string[]) {
  return {
    stdout(line: string) {
      output.push(line);
    },
    stderr(line: string) {
      output.push(line);
    }
  };
}
