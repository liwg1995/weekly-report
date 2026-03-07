import { logoutWithConfirm } from "./auth-session";
import { navigateTo } from "./navigation";

jest.mock("./navigation", () => ({
  navigateTo: jest.fn()
}));

describe("auth-session logoutWithConfirm", () => {
  beforeEach(() => {
    window.localStorage.setItem("accessToken", "token");
    window.localStorage.setItem(
      "sessionUser",
      JSON.stringify({ username: "admin", roles: ["SUPER_ADMIN"] })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("does not logout when user cancels confirmation", () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    logoutWithConfirm();
    expect(window.localStorage.getItem("accessToken")).toBe("token");
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("clears session and redirects when user confirms", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    logoutWithConfirm();
    expect(window.localStorage.getItem("accessToken")).toBeNull();
    expect(window.localStorage.getItem("sessionUser")).toBeNull();
    expect(navigateTo).toHaveBeenCalledWith("/login");
  });
});
