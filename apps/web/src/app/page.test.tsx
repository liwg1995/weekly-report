import { render, waitFor } from "@testing-library/react";
import HomePage from "./page";
import { navigateTo } from "../lib/navigation";

jest.mock("../lib/navigation", () => ({
  navigateTo: jest.fn()
}));

describe("HomePage", () => {
  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it("redirects to login without session", async () => {
    render(<HomePage />);
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/login");
    });
  });

  it("redirects manager role to reviews page", async () => {
    window.localStorage.setItem("accessToken", "token");
    window.localStorage.setItem(
      "sessionUser",
      JSON.stringify({ username: "admin", roles: ["SUPER_ADMIN"] })
    );

    render(<HomePage />);
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/manager/reviews");
    });
  });

  it("redirects employee role to feedback page", async () => {
    window.localStorage.setItem("accessToken", "token");
    window.localStorage.setItem(
      "sessionUser",
      JSON.stringify({ username: "alice", roles: ["EMPLOYEE"] })
    );

    render(<HomePage />);
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/employee/feedback");
    });
  });
});
