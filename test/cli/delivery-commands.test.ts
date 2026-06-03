import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";

describe("removed delivery CLI command", () => {
  it("does not expose delivery configuration as a public command", async () => {
    for (const args of [["delivery"], ["delivery", "configure"], ["delivery", "status"], ["delivery", "test"]]) {
      await expect(runCli(args, captureOutput([]), {})).rejects.toThrow("Unknown command: delivery");
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
