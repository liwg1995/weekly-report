import { render, screen, waitFor } from "@testing-library/react";
import { useAuthGuard } from "./use-auth-guard";
import { navigateTo } from "./navigation";
import { getSessionUser, requireAuth } from "./auth-session";
import { canAccessRoute, getAllowedCapabilitiesForRoles } from "./authz";

jest.mock("./navigation", () => ({
  navigateTo: jest.fn()
}));

jest.mock("./auth-session", () => ({
  getSessionUser: jest.fn(),
  requireAuth: jest.fn()
}));

jest.mock("./authz", () => ({
  canAccessRoute: jest.fn(),
  getAllowedCapabilitiesForRoles: jest.fn()
}));

function Probe({ path = "/manager/reviews" }: { path?: string }) {
  const state = useAuthGuard({
    currentPath: path,
    requiredAny: ["reviews:read"]
  });
  return <div>{state.ready ? "ready" : state.blocked ? "blocked" : "idle"}</div>;
}

describe("useAuthGuard", () => {
  beforeEach(() => {
    (requireAuth as jest.Mock).mockReturnValue("token");
    (getSessionUser as jest.Mock).mockReturnValue({ username: "admin", roles: ["SUPER_ADMIN"] });
    (getAllowedCapabilitiesForRoles as jest.Mock).mockReturnValue(["reviews:read"]);
    (canAccessRoute as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("blocks when token missing", async () => {
    (requireAuth as jest.Mock).mockReturnValue("");
    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByText("blocked")).toBeInTheDocument();
    });
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("redirects login when session user missing", async () => {
    (getSessionUser as jest.Mock).mockReturnValue(null);
    render(<Probe />);

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/login");
      expect(screen.getByText("blocked")).toBeInTheDocument();
    });
  });

  it("redirects forbidden when route policy denied", async () => {
    (canAccessRoute as jest.Mock).mockReturnValue(false);
    render(<Probe path="/manager/reviews" />);

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/forbidden?from=%2Fmanager%2Freviews");
      expect(screen.getByText("blocked")).toBeInTheDocument();
    });
  });

  it("becomes ready when route and capability allowed", async () => {
    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByText("ready")).toBeInTheDocument();
    });
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
