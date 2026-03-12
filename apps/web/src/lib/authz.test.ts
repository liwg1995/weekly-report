import {
  canAccessRoute,
  getCapabilitiesForRoles,
  getDefaultWorkspace,
  getLandingPathForWorkspace
} from "./authz";

describe("authz", () => {
  it("maps roles to default workspace", () => {
    expect(getDefaultWorkspace(["SUPER_ADMIN"])) .toBe("admin-workspace");
    expect(getDefaultWorkspace(["MANAGER"])) .toBe("review-workspace");
    expect(getDefaultWorkspace(["EMPLOYEE"])) .toBe("employee-workspace");
  });

  it("resolves workspace landing paths", () => {
    expect(getLandingPathForWorkspace("admin-workspace")).toBe("/manager/org");
    expect(getLandingPathForWorkspace("review-workspace")).toBe("/manager/reviews");
    expect(getLandingPathForWorkspace("employee-workspace")).toBe("/employee/feedback");
  });

  it("checks route capability access", () => {
    const managerCaps = getCapabilitiesForRoles(["MANAGER"]);
    expect(canAccessRoute("/manager/reviews", managerCaps)).toBe(true);
    expect(canAccessRoute("/employee/feedback", managerCaps)).toBe(false);
    expect(canAccessRoute("/manager/org", managerCaps)).toBe(false);
  });
});
