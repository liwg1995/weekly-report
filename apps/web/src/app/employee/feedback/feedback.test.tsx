import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmployeeFeedbackPage from "./page";
import { navigateTo } from "../../../lib/navigation";

jest.mock("../../../lib/navigation", () => ({
  navigateTo: jest.fn()
}));

describe("EmployeeFeedbackPage", () => {
  beforeEach(() => {
    (navigateTo as jest.Mock).mockClear();
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
        json: async () => ({ items: [] })
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

  it("shows mention status and submit time on feedback card", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              reportId: 88,
              latestDecision: "APPROVED",
              latestComment: "已通过",
              status: "APPROVED",
              thisWeekText: "x",
              latestReviewedAt: "2026-03-10T10:00:00.000Z",
              submittedAt: "2026-03-10T08:30:00.000Z",
              mentionLeader: true,
              mentionComment: "@leader 请查阅"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 88, status: "APPROVED", thisWeekText: "x" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByText("已@直属领导：@leader 请查阅")).toBeInTheDocument();
      expect(screen.getByText(/提交于/)).toBeInTheDocument();
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
        json: async () => ({ items: [] })
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
        json: async () => ({ items: [] })
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

  it("shows my report overview stats and recent list", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 101, status: "PENDING_APPROVAL", thisWeekText: "推进审批优化" },
            { id: 102, status: "APPROVED", thisWeekText: "完成组织梳理" },
            { id: 103, status: "REJECTED", thisWeekText: "补充风险说明" }
          ]
        })
      }) as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByText("我的周报概览")).toBeInTheDocument();
      expect(screen.getByText("待审批：1")).toBeInTheDocument();
      expect(screen.getByText("已通过：1")).toBeInTheDocument();
      expect(screen.getByText("已驳回：1")).toBeInTheDocument();
      expect(screen.getByText("总数：3")).toBeInTheDocument();
      expect(screen.getByText("#101 推进审批优化（PENDING_APPROVAL）")).toBeInTheDocument();
    });
  });

  it("redirects manager role to forbidden page", async () => {
    window.localStorage.setItem(
      "sessionUser",
      JSON.stringify({ username: "manager01", roles: ["MANAGER"] })
    );
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] })
    } as Response) as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/forbidden?from=%2Femployee%2Ffeedback");
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
        json: async () => ({
          items: [
            { id: 61, status: "REJECTED", thisWeekText: "x" },
            { id: 62, status: "APPROVED", thisWeekText: "y" }
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

  it("submits weekly report from employee page", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 3001, status: "PENDING_APPROVAL" })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "提交周报" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("本周工作"), {
      target: { value: "完成审批优化" }
    });
    fireEvent.change(screen.getByLabelText("下周计划"), {
      target: { value: "推进组织管理细化" }
    });
    fireEvent.change(screen.getByLabelText("风险与阻塞"), {
      target: { value: "暂无" }
    });
    fireEvent.change(screen.getByLabelText("需协助事项"), {
      target: { value: "请协助联调" }
    });
    fireEvent.click(screen.getByLabelText("@直属领导提醒"));
    fireEvent.change(screen.getByLabelText("@提醒备注"), {
      target: { value: "@leader 本条需要优先看" }
    });
    fireEvent.click(screen.getByRole("button", { name: "提交周报" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("\"mentionLeader\":true")
        })
      );
      expect(screen.getByText("周报已提交，等待直属主管审批。")).toBeInTheDocument();
    });
  });

  it("resubmits rejected report from feedback card", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              reportId: 77,
              latestDecision: "REJECTED",
              latestComment: "请补充里程碑",
              status: "REJECTED",
              thisWeekText: "内容",
              latestReviewedAt: "2026-03-08T10:00:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 77, status: "PENDING_APPROVAL" })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              reportId: 77,
              latestDecision: "REJECTED",
              latestComment: "请补充里程碑",
              status: "REJECTED",
              thisWeekText: "内容",
              latestReviewedAt: "2026-03-08T10:00:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<EmployeeFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重新提交" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "重新提交" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports/77",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "resubmit" })
        })
      );
      expect(screen.getByText("周报 #77 已重新提交。")).toBeInTheDocument();
    });
  });
});
