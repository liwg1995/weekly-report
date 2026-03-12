import { render, screen } from "@testing-library/react";
import AppShell from "./app-shell";

jest.mock("../lib/auth-session", () => ({
  getSessionUser: () => ({ username: "admin", roles: ["SUPER_ADMIN"] }),
  logoutWithConfirm: jest.fn()
}));

describe("AppShell", () => {
  it("renders title and navigation", () => {
    render(
      <AppShell workspace="admin-workspace" pageTitle="组织管理">
        <div>content</div>
      </AppShell>
    );

    expect(screen.getByRole("heading", { level: 2, name: "组织管理" })).toBeInTheDocument();
    expect(screen.getByText("组织管理", { selector: "a" })).toBeInTheDocument();
    expect(screen.getByText("绩效配置")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
