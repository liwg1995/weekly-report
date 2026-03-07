import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmployeeFeedbackPage from "./page";
import { navigateTo } from "../../../lib/navigation";

jest.mock("../../../lib/navigation", () => ({
  navigateTo: jest.fn()
}));

describe("EmployeeFeedbackPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("accessToken", "test-token");
    window.localStorage.setItem(
      "sessionUser",
      JSON.stringify({ username: "alice", roles: ["EMPLOYEE"] })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("renders latest suggestion and timeline", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              reportId: 12,
              latestDecision: "REJECTED",
              latestComment: "请补充风险说明",
              status: "REJECTED",
              thisWeekText: "x",
              latestReviewedAt: "2026-03-05T10:00:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 1,
              decision: "REJECTED",
              comment: "请补充风险说明",
              createdAt: "2026-03-05T10:00:00.000Z",
              reviewer: { realName: "系统管理员", username: "admin" }
            }
          ]
        })
      }) as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByText("请补充风险说明")).toBeInTheDocument();
      expect(screen.getByText(/审批时间线/)).toBeInTheDocument();
    });
  });

  it("switches timeline when clicking another feedback item", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              reportId: 12,
              latestDecision: "REJECTED",
              latestComment: "请补充风险说明",
              status: "REJECTED",
              thisWeekText: "x",
              latestReviewedAt: "2026-03-05T10:00:00.000Z"
            },
            {
              reportId: 13,
              latestDecision: "APPROVED",
              latestComment: "内容完整，已通过",
              status: "APPROVED",
              thisWeekText: "y",
              latestReviewedAt: "2026-03-06T10:00:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 1,
              decision: "REJECTED",
              comment: "请补充风险说明",
              createdAt: "2026-03-05T10:00:00.000Z",
              reviewer: { realName: "系统管理员", username: "admin" }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 2,
              decision: "APPROVED",
              comment: "内容完整，已通过",
              createdAt: "2026-03-06T10:00:00.000Z",
              reviewer: { realName: "系统管理员", username: "admin" }
            }
          ]
        })
      }) as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByText("请补充风险说明")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /周报 #13/ }));

    await waitFor(() => {
      expect(screen.getAllByText("内容完整，已通过").length).toBeGreaterThan(0);
    });
  });

  it("filters feedback list by decision", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              reportId: 12,
              latestDecision: "REJECTED",
              latestComment: "请补充风险说明",
              status: "REJECTED",
              thisWeekText: "x",
              latestReviewedAt: "2026-03-05T10:00:00.000Z"
            },
            {
              reportId: 13,
              latestDecision: "APPROVED",
              latestComment: "内容完整，已通过",
              status: "APPROVED",
              thisWeekText: "y",
              latestReviewedAt: "2026-03-06T10:00:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<EmployeeFeedbackPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /仅驳回/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /仅驳回/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /周报 #12/ })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /周报 #13/ })
      ).not.toBeInTheDocument();
    });
  });

  it("sorts feedback list by reviewed time", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              reportId: 12,
              latestDecision: "REJECTED",
              latestComment: "旧记录",
              status: "REJECTED",
              thisWeekText: "x",
              latestReviewedAt: "2026-03-05T10:00:00.000Z"
            },
            {
              reportId: 13,
              latestDecision: "APPROVED",
              latestComment: "新记录",
              status: "APPROVED",
              thisWeekText: "y",
              latestReviewedAt: "2026-03-06T10:00:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /最新优先/ })).toBeInTheDocument();
    });

    const initialOrder = screen
      .getAllByRole("button")
      .map((btn) => btn.textContent || "")
      .filter((text) => text.includes("周报 #"));
    expect(initialOrder[0]).toContain("周报 #13");

    fireEvent.click(screen.getByRole("button", { name: /最新优先/ }));

    await waitFor(() => {
      const ascOrder = screen
        .getAllByRole("button")
        .map((btn) => btn.textContent || "")
        .filter((text) => text.includes("周报 #"));
      expect(ascOrder[0]).toContain("周报 #12");
    });
  });

  it("expands and collapses long timeline comment", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              reportId: 22,
              latestDecision: "REJECTED",
              latestComment:
                "请补充非常详细的风险说明，包含影响范围、缓解措施、预计完成时间以及相关依赖方信息",
              status: "REJECTED",
              thisWeekText: "x",
              latestReviewedAt: "2026-03-06T10:00:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 99,
              decision: "REJECTED",
              comment:
                "请补充非常详细的风险说明，包含影响范围、缓解措施、预计完成时间以及相关依赖方信息",
              createdAt: "2026-03-06T10:00:00.000Z",
              reviewer: { realName: "系统管理员", username: "admin" }
            }
          ]
        })
      }) as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /展开/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /展开/ }));
    expect(screen.getByRole("button", { name: /收起/ })).toBeInTheDocument();
  });

  it("redirects manager role to reviews page", async () => {
    window.localStorage.setItem(
      "sessionUser",
      JSON.stringify({ username: "admin", roles: ["SUPER_ADMIN"] })
    );
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] })
    } as Response) as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/manager/reviews");
    });
  });

  it("shows rejected reminder banner when there are pending resubmissions", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              reportId: 61,
              latestDecision: "REJECTED",
              latestComment: "请补充数据口径",
              status: "REJECTED",
              thisWeekText: "x",
              latestReviewedAt: "2026-03-06T10:00:00.000Z"
            },
            {
              reportId: 62,
              latestDecision: "APPROVED",
              latestComment: "已通过",
              status: "APPROVED",
              thisWeekText: "y",
              latestReviewedAt: "2026-03-06T09:00:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByText("你有 1 条周报被驳回，待修改后重新提交。")).toBeInTheDocument();
    });
  });
});
