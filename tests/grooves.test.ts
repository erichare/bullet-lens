import { describe, expect, it } from "vitest";
import { extractGrooveRegions, grooveRegionToDisplayRect } from "@/lib/grooves";
import { parseX3p } from "@/lib/x3p";
import { asFile, buildSyntheticX3p } from "./fixtures/build-x3p";

describe("groove region extraction", () => {
  it("extracts selected groove rows by filename", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 40, sizeY: 10 });
    const scan = await parseX3p(asFile(zipBytes, "Land 1.x3p"));
    const response = {
      groove_detections: {
        selected: { key: "manual" },
        manual: {
          grooves: [
            {
              land: 1,
              filename: "Land 1.x3p",
              left_groove: 5,
              right_groove: 30,
              crosscut_y: 4,
              boundary_method: "csv",
            },
          ],
        },
      },
    };

    const regions = extractGrooveRegions(response, [scan]);

    expect(regions["Land 1.x3p"]).toHaveLength(1);
    expect(regions["Land 1.x3p"][0]).toMatchObject({
      leftGroove: 5,
      rightGroove: 30,
      crosscutY: 4,
      method: "csv",
    });
  });

  it("maps source X boundaries to displayed X for landscape scans", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 40, sizeY: 10 });
    const scan = await parseX3p(asFile(zipBytes, "landscape.x3p"));
    const rect = grooveRegionToDisplayRect(
      {
        scanName: scan.name,
        leftGroove: 10,
        rightGroove: 30,
      },
      scan,
    );

    expect(rect.x0).toBeCloseTo(10 / 39);
    expect(rect.x1).toBeCloseTo(30 / 39);
    expect(rect.y0).toBe(0);
    expect(rect.y1).toBe(1);
  });

  it("maps source X boundaries to displayed Y for auto-transposed ribbons", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 10, sizeY: 40 });
    const scan = await parseX3p(asFile(zipBytes, "ribbon.x3p"));
    const rect = grooveRegionToDisplayRect(
      {
        scanName: scan.name,
        leftGroove: 2,
        rightGroove: 8,
        crosscutY: 20,
      },
      scan,
    );

    expect(scan.orientation.transposed).toBe(true);
    expect(rect.x0).toBe(0);
    expect(rect.x1).toBe(1);
    expect(rect.y0).toBeCloseTo(2 / 9);
    expect(rect.y1).toBeCloseTo(8 / 9);
    expect(rect.crosscutX).toBeCloseTo(20 / 39);
  });
});
