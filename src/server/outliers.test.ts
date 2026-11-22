import { describe, expect, it } from "vitest";
import { median, outlierScores } from "./outliers";
import { blanksOf, fillTemplate } from "./templates";

describe("outlier score", () => {
  it("is views over the channel's median", () => {
    const scores = outlierScores([
      { id: "a", channelId: "c", views: 12000 },
      { id: "b", channelId: "c", views: 96000 },
      { id: "d", channelId: "c", views: 15000 },
    ]);
    expect(scores.get("b")).toBeCloseTo(6.4);
    expect(scores.get("a")).toBeCloseTo(0.8);
  });
  it("waits for three videos", () => {
    const scores = outlierScores([
      { id: "a", channelId: "c", views: 100 },
      { id: "b", channelId: "c", views: 200 },
    ]);
    expect(scores.get("a")).toBeNull();
  });
  it("takes the middle of an even list", () => {
    expect(median([1, 3, 2, 10])).toBe(2.5);
  });
});

describe("templates", () => {
  it("lists and fills blanks", () => {
    const t = "Stop [habit] for [time]. [habit] again?";
    expect(blanksOf(t)).toEqual(["habit", "time"]);
    expect(fillTemplate(t, { habit: "snoozing", time: "" })).toBe(
      "Stop snoozing for [time]. snoozing again?",
    );
  });
});
