import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";
import { navigateTo } from "../../lib/navigation";

jest.mock("../../lib/navigation", () => ({
  navigateTo: jest.fn()
}));

describe("LoginPage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("renders login form with username and password", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("用户名")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
  });

  it("stores access token after successful login", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        accessToken: "token-123",
        user: { username: "admin", roles: ["SUPER_ADMIN"] }
      })
    } as Response) as typeof fetch;

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "admin" }
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "123456" }
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("accessToken")).toBe("token-123");
      expect(window.localStorage.getItem("sessionUser")).toContain("\"SUPER_ADMIN\"");
      expect(screen.getByText("登录成功")).toBeInTheDocument();
      expect(navigateTo).toHaveBeenCalledWith("/manager/org");
    });
  });

  it("shows credential error on 401 without auto redirect", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" })
    } as Response) as typeof fetch;

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "admin" }
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "bad" }
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByText("用户名或密码错误")).toBeInTheDocument();
      expect(window.localStorage.getItem("accessToken")).toBeNull();
    });
  });

  it("redirects employee to feedback page after login", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        accessToken: "token-emp",
        user: { username: "alice", roles: ["EMPLOYEE"] }
      })
    } as Response) as typeof fetch;

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "alice" }
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "123456" }
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/employee/feedback");
    });
  });
});
