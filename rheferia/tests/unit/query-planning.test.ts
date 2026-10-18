import { describe, expect, it } from "vitest";
import { planQuery } from "@/lib/search/query-planning";

describe("query planning", () => {
  it("detects a DOI in auto mode", () => {
    const plan = planQuery({ query: "10.1038/nature12373", mode: "auto" });
    expect(plan.mode).toBe("doi");
    expect(plan.detectedDoi).toBe("10.1038/nature12373");
    expect(plan.queries).toEqual(["10.1038/nature12373"]);
  });

  it("detects a DOI inside a longer sentence", () => {
    const plan = planQuery({
      query: "The paper at https://doi.org/10.1016/j.scied.2022.103487 discusses this",
      mode: "auto",
    });
    expect(plan.mode).toBe("doi");
    expect(plan.detectedDoi).toBe("10.1016/j.scied.2022.103487");
  });

  it("extracts concepts from the brief's illustrative title", () => {
    const plan = planQuery({
      query:
        "Offline Classroom Response Systems and Student Engagement in Grade 10 Mathematics",
      mode: "title-question",
    });
    expect(plan.keywords).toContain("classroom response systems");
    expect(plan.keywords).toContain("student engagement");
    expect(plan.keywords.length).toBeLessThanOrEqual(10);
    expect(plan.queries.length).toBeLessThanOrEqual(3); // bounded set
    expect(plan.queries[0]).toContain("Offline Classroom Response Systems");
  });

  it("broadens a very long title into a concept query and labels it", () => {
    const plan = planQuery({
      query:
        "Offline Classroom Response Systems and Student Engagement in Grade 10 Mathematics in the Philippines",
      mode: "title-question",
    });
    expect(plan.queries.length).toBeGreaterThan(1);
  });

  it("treats short noun phrases as possible exact titles", () => {
    const plan = planQuery({
      query: "Crowdsourced grading in higher education",
      mode: "auto",
    });
    expect(plan.mode).toBe("exact-title");
  });

  it("treats questions as title-question mode", () => {
    const plan = planQuery({
      query: "How do response systems affect engagement?",
      mode: "auto",
    });
    expect(plan.mode).toBe("title-question");
  });

  it("bounds the query set size", () => {
    const plan = planQuery({
      query:
        "A Very Long Study About Classroom Response Systems, Student Engagement, Mathematics Education, Offline Learning Technology, Modular Distance Learning, And Blended Approaches",
      mode: "title-question",
    });
    expect(plan.queries.length).toBeLessThanOrEqual(3);
  });
});
