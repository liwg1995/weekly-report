import { render, screen } from "@testing-library/react";
import SessionExpiryNotice from "./session-expiry-notice";

const makeToken = (expEpochSec: number) => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const payload = btoa(JSON.stringify({ exp: expEpochSec }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${header}.${payload}.sig`;
};

describe("SessionExpiryNotice", () => {
  const now = new Date("2026-03-05T10:00:00.000Z").getTime();

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(now);
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("shows warning when token expires within 30 minutes", () => {
    window.localStorage.setItem("accessToken", makeToken(Math.floor(now / 1000) + 10 * 60));
    render(<SessionExpiryNotice />);
    expect(screen.getByText(/登录将在 10 分钟后过期/)).toBeInTheDocument();
  });

  it("does not show warning when token is still long-lived", () => {
    window.localStorage.setItem("accessToken", makeToken(Math.floor(now / 1000) + 2 * 60 * 60));
    render(<SessionExpiryNotice />);
    expect(screen.queryByText(/登录将在/)).not.toBeInTheDocument();
  });
});
