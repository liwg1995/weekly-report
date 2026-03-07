import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Prisma schema", () => {
  it("contains core models for weekly report system", () => {
    const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toContain("model User");
    expect(schema).toContain("model Department");
    expect(schema).toContain("model WeeklyReport");
    expect(schema).toContain("model ReportReview");
    expect(schema).toContain("model AuditLog");
  });
});
