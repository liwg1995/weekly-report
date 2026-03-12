import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManagerReviewsPage from "./page";
import { navigateTo } from "../../../lib/navigation";

jest.mock("../../../lib/navigation", () => ({
  navigateTo: jest.fn()
}));

describe("ManagerReviewsPage", () => {
  beforeEach(() => {
    (navigateTo as jest.Mock).mockClear();
    window.localStorage.setItem("accessToken", "test-token");
    window.localStorage.setItem(
      "sessionUser",
      JSON.stringify({ username: "admin", roles: ["SUPER_ADMIN"] })
    );
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("shows permission message when api returns 403", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403
    } as Response) as typeof fetch;

    render(<ManagerReviewsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("你当前没有审批权限，请联系管理员分配角色。")
      ).toBeInTheDocument();
    });
  });

  it("approves report and removes it from list", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 1, thisWeekText: "修复审批页", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 100 })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 999,
              action: "REVIEW_APPROVED",
              targetId: "1",
              createdAt: "2026-03-06",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText("修复审批页")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "通过" }));

    await waitFor(() => {
      expect(screen.getByText("已通过 1 条周报")).toBeInTheDocument();
      expect(screen.queryByText("修复审批页")).not.toBeInTheDocument();
      expect(screen.getByText(/周报 #1/)).toBeInTheDocument();
    });
  });

  it("rejects report with custom reason", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 2, thisWeekText: "补充风险说明", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 101 })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 1001,
              action: "REVIEW_REJECTED",
              targetId: "2",
              createdAt: "2026-03-06",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("补充风险说明")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "驳回" }));
    fireEvent.change(screen.getByLabelText("驳回原因"), {
      target: { value: "请补充风险影响范围和完成时间" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认驳回" }));

    await waitFor(() => {
      expect(screen.getByText("已驳回 1 条周报")).toBeInTheDocument();
      expect(screen.queryByText("补充风险说明")).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/audit-logs/reviews?limit=10",
      expect.objectContaining({
        method: "GET"
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/weekly-reports/2/review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          decision: "REJECTED",
          comment: "请补充风险影响范围和完成时间"
        })
      })
    );
  });

  it("shows error when reject reason is empty", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: 3, thisWeekText: "空原因校验", status: "PENDING_APPROVAL" }]
      })
    }).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] })
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("空原因校验")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "驳回" }));
    fireEvent.click(screen.getByRole("button", { name: "确认驳回" }));

    await waitFor(() => {
      expect(screen.getByText("请填写驳回原因")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("redirects employee role to forbidden page", async () => {
    window.localStorage.setItem(
      "sessionUser",
      JSON.stringify({ username: "alice", roles: ["EMPLOYEE"] })
    );

    render(<ManagerReviewsPage />);

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/forbidden?from=%2Fmanager%2Freviews");
    });
  });

  it("approves selected reports in batch", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 11, thisWeekText: "批量一", status: "PENDING_APPROVAL" },
            { id: 12, thisWeekText: "批量二", status: "PENDING_APPROVAL" }
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
        status: 201,
        json: async () => ({ ok: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ ok: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 2001,
              action: "REVIEW_APPROVED",
              targetId: "11",
              createdAt: "2026-03-06",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            },
            {
              id: 2002,
              action: "REVIEW_APPROVED",
              targetId: "12",
              createdAt: "2026-03-06",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("批量一")).toBeInTheDocument();
      expect(screen.getByText("批量二")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择周报-11"));
    fireEvent.click(screen.getByLabelText("选择周报-12"));
    fireEvent.click(screen.getByRole("button", { name: "批量通过" }));

    await waitFor(() => {
      expect(screen.getByText("已通过 2 条周报")).toBeInTheDocument();
      expect(screen.queryByText("批量一")).not.toBeInTheDocument();
      expect(screen.queryByText("批量二")).not.toBeInTheDocument();
      expect(screen.getByText(/周报 #11/)).toBeInTheDocument();
    });
  });

  it("supports select all and clear selection", async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: 21, thisWeekText: "A", status: "PENDING_APPROVAL" },
          { id: 22, thisWeekText: "B", status: "PENDING_APPROVAL" }
        ]
      })
    }).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] })
    } as Response) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("B")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "全选" }));
    expect((screen.getByLabelText("选择周报-21") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("选择周报-22") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "取消全选" }));
    expect((screen.getByLabelText("选择周报-21") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("选择周报-22") as HTMLInputElement).checked).toBe(false);
  });

  it("shows reject preview list for selected reports", async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: 31, thisWeekText: "预览一", status: "PENDING_APPROVAL" },
          { id: 32, thisWeekText: "预览二", status: "PENDING_APPROVAL" }
        ]
      })
    }).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] })
    } as Response) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("预览一")).toBeInTheDocument();
      expect(screen.getByText("预览二")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择周报-31"));
    fireEvent.click(screen.getByLabelText("选择周报-32"));
    fireEvent.click(screen.getByRole("button", { name: "批量驳回" }));

    await waitFor(() => {
      expect(screen.getByText(/将驳回以下周报：/)).toBeInTheDocument();
      expect(screen.getByText(/#31 预览一/)).toBeInTheDocument();
      expect(screen.getByText(/#32 预览二/)).toBeInTheDocument();
    });
  });

  it("shows approval stats cards based on pending and logs", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 41, thisWeekText: "统计一", status: "PENDING_APPROVAL" },
            { id: 42, thisWeekText: "统计二", status: "PENDING_APPROVAL" }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 3001,
              action: "REVIEW_APPROVED",
              targetId: "41",
              createdAt: "2026-03-06",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            },
            {
              id: 3002,
              action: "REVIEW_REJECTED",
              targetId: "42",
              createdAt: "2026-03-06",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText("待审批总数")).toBeInTheDocument();
      expect(screen.getByText("已选择")).toBeInTheDocument();
      expect(screen.getByText("通过 1 / 驳回 1")).toBeInTheDocument();
      expect(screen.getByText("今日审批")).toBeInTheDocument();
      expect(screen.getByTestId("stats-range-trend").textContent).toMatch(/[↑↓→]/);
    });
  });

  it("filters operation logs by decision", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 51, thisWeekText: "过滤日志", status: "PENDING_APPROVAL" }]
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
              id: 4002,
              action: "REVIEW_REJECTED",
              targetId: "51",
              createdAt: "2026-03-06",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText("过滤日志")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("日志结果筛选"), {
      target: { value: "REJECTED" }
    });
    fireEvent.click(screen.getByRole("button", { name: "筛选日志" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/audit-logs/reviews?limit=10&decision=REJECTED",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("switches stats range and shows trend percent with arrow", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-20T10:00:00.000Z"));
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 71, thisWeekText: "范围统计", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 7001,
              action: "REVIEW_APPROVED",
              targetId: "71",
              createdAt: "2026-03-20T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            },
            {
              id: 7002,
              action: "REVIEW_REJECTED",
              targetId: "72",
              createdAt: "2026-03-18T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            },
            {
              id: 7003,
              action: "REVIEW_APPROVED",
              targetId: "73",
              createdAt: "2026-03-10T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            },
            {
              id: 7004,
              action: "REVIEW_REJECTED",
              targetId: "74",
              createdAt: "2026-03-05T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            },
            {
              id: 7005,
              action: "REVIEW_APPROVED",
              targetId: "75",
              createdAt: "2026-02-25T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("stats-range-count")).toHaveTextContent("1");
    });

    fireEvent.click(screen.getByRole("button", { name: "近7天" }));
    expect(screen.getByTestId("stats-range-count")).toHaveTextContent("2");
    expect(screen.getByTestId("stats-range-trend").textContent).toMatch(/[↑↓]/);
    expect(screen.getByTestId("stats-range-trend")).toHaveTextContent("%");

    fireEvent.click(screen.getByRole("button", { name: "本月" }));
    expect(screen.getByTestId("stats-range-count")).toHaveTextContent("4");
    jest.useRealTimers();
  });

  it("shows employee and leader info and supports next page query", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 901,
              thisWeekText: "分页第一页",
              status: "PENDING_APPROVAL",
              user: {
                id: 11,
                username: "zhangsan",
                realName: "张三",
                leader: { id: 12, username: "leader01", realName: "李主管" }
              }
            }
          ],
          total: 21,
          page: 1,
          pageSize: 20
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
          items: [],
          total: 21,
          page: 2,
          pageSize: 20
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText(/员工: 张三（zhangsan）/)).toBeInTheDocument();
      expect(screen.getByText(/直属领导: 李主管/)).toBeInTheDocument();
    });

    const nextButtons = screen.getAllByRole("button", { name: "下一页" });
    fireEvent.click(nextButtons.find((button) => !(button as HTMLButtonElement).disabled) as HTMLElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=2&pageSize=20",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("supports overdue quick filter and shows risk/help highlights", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 951,
              thisWeekText: "逾期任务",
              risksText: "联调阻塞",
              needsHelpText: "需要产品确认方案",
              status: "PENDING_APPROVAL",
              isOverdue: true,
              dueAt: "2026-03-06T10:00:00.000Z"
            }
          ],
          total: 1,
          page: 1,
          pageSize: 20
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
              id: 951,
              thisWeekText: "逾期任务",
              risksText: "联调阻塞",
              needsHelpText: "需要产品确认方案",
              status: "PENDING_APPROVAL",
              isOverdue: true,
              dueAt: "2026-03-06T10:00:00.000Z"
            }
          ],
          total: 1,
          page: 1,
          pageSize: 20
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("逾期任务")).toBeInTheDocument();
      expect(screen.getByText(/风险提示：联调阻塞/)).toBeInTheDocument();
      expect(screen.getByText(/协助诉求：需要产品确认方案/)).toBeInTheDocument();
      expect(screen.getByText(/已逾期/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "只看逾期" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&overdueFirst=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("shows mention badge and supports mention-only filter", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 956,
              thisWeekText: "需要主管关注",
              status: "PENDING_APPROVAL",
              mentionLeader: true,
              mentionComment: "请今天内确认方案"
            }
          ],
          total: 1,
          page: 1,
          pageSize: 20
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
              id: 956,
              thisWeekText: "需要主管关注",
              status: "PENDING_APPROVAL",
              mentionLeader: true,
              mentionComment: "请今天内确认方案"
            }
          ],
          total: 1,
          page: 1,
          pageSize: 20
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("需要主管关注")).toBeInTheDocument();
      expect(screen.getByText("@领导提醒：请今天内确认方案")).toBeInTheDocument();
      expect(screen.getByText(/请今天内确认方案/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "只看@领导提醒" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&mentionLeaderOnly=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("supports mention-first sorting query", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 957, thisWeekText: "提醒优先", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
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
          items: [{ id: 957, thisWeekText: "提醒优先", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "提醒优先排序" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "提醒优先排序" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&mentionFirst=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("supports my-direct-team quick filter query", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 958, thisWeekText: "直属团队任务", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
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
          items: [{ id: 958, thisWeekText: "直属团队任务", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("直属团队任务")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "仅我直属团队" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&myDirectOnly=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("supports sort selector query for mention-first and overdue-first", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: 1701, thisWeekText: "排序验证", status: "PENDING_APPROVAL" }],
        total: 1,
        page: 1,
        pageSize: 20
      })
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("排序验证")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("审批排序"), { target: { value: "mentionFirst" } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&mentionFirst=true",
        expect.objectContaining({ method: "GET" })
      );
    });

    fireEvent.change(screen.getByLabelText("审批排序"), { target: { value: "overdueFirst" } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&overdueFirst=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("supports my-pending preset quick filter query", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: 1702, thisWeekText: "预设-待我审批", status: "PENDING_APPROVAL" }],
        total: 1,
        page: 1,
        pageSize: 20
      })
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("预设-待我审批")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "待我审批预设" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&mentionFirst=true&myDirectOnly=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("supports mention-priority preset quick filter query", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: 1703, thisWeekText: "预设-提醒优先", status: "PENDING_APPROVAL" }],
        total: 1,
        page: 1,
        pageSize: 20
      })
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("预设-提醒优先")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "@提醒优先预设" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&mentionLeaderOnly=true&mentionFirst=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("shows efficiency panel groups and supports one-click handling entry", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 1711, thisWeekText: "逾期待办", status: "PENDING_APPROVAL", isOverdue: true },
            {
              id: 1712,
              thisWeekText: "@提醒待办",
              status: "PENDING_APPROVAL",
              mentionLeader: true
            },
            { id: 1713, thisWeekText: "普通待办", status: "PENDING_APPROVAL" }
          ],
          total: 3,
          page: 1,
          pageSize: 20
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("审批效率面板")).toBeInTheDocument();
      expect(screen.getByText("逾期待办：1")).toBeInTheDocument();
      expect(screen.getByText("@提醒待办：1")).toBeInTheDocument();
      expect(screen.getByText("普通待办：1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "一键处理@提醒" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&mentionLeaderOnly=true&mentionFirst=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("shows sla reminders and supports nudge placeholder actions", async () => {
    const now = Date.now();
    const due26h = new Date(now - 26 * 60 * 60 * 1000).toISOString();
    const due50h = new Date(now - 50 * 60 * 60 * 1000).toISOString();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 1721,
              thisWeekText: "超24h",
              status: "PENDING_APPROVAL",
              isOverdue: true,
              dueAt: due26h
            },
            {
              id: 1722,
              thisWeekText: "超48h",
              status: "PENDING_APPROVAL",
              isOverdue: true,
              dueAt: due50h
            },
            {
              id: 1723,
              thisWeekText: "普通",
              status: "PENDING_APPROVAL"
            }
          ],
          total: 3,
          page: 1,
          pageSize: 20
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 8801,
          level: "SLA24",
          status: "PENDING",
          channel: "LOCAL_PLACEHOLDER",
          targetCount: 2,
          message: "超24h未处理催办任务，涉及 2 条周报",
          createdAt: "2026-03-11T08:00:00.000Z"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 8801,
              level: "SLA24",
              status: "PENDING",
              channel: "LOCAL_PLACEHOLDER",
              targetCount: 2,
              message: "超24h未处理催办任务，涉及 2 条周报",
              createdAt: "2026-03-11T08:00:00.000Z"
            }
          ]
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("超24h未处理：2")).toBeInTheDocument();
      expect(screen.getByText("超48h未处理：1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "一键定位超48h" }));
    await waitFor(() => {
      expect(screen.getByText("已定位 1 条超48h待办，请优先处理。")).toBeInTheDocument();
    });
    expect((screen.getByLabelText("选择周报-1722") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "一键催办（占位）" }));
    await waitFor(() => {
      expect(
        screen.getByText("催办任务已创建：超24h待办 2 条（企业微信/钉钉提醒待接入）。")
      ).toBeInTheDocument();
      expect(screen.getByText("催办队列")).toBeInTheDocument();
      expect(screen.getByText("#8801 SLA24 / 2条 / PENDING")).toBeInTheDocument();
    });
  });

  it("supports updating nudge queue item status", async () => {
    let nudgeStatus: "PENDING" | "SENT" = "PENDING";
    const fetchMock = jest.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.includes("/api/weekly-reports?status=PENDING_APPROVAL")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 1731, thisWeekText: "nudge", status: "PENDING_APPROVAL" }],
            total: 1,
            page: 1,
            pageSize: 20
          })
        } as Response;
      }
      if (url.includes("/api/audit-logs/reviews?limit=10")) {
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response;
      }
      if (url.includes("/api/weekly-reports/review-nudges?page=1&pageSize=5")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 9901,
                level: "SLA24",
                status: nudgeStatus,
                channel: "LOCAL_PLACEHOLDER",
                targetCount: 1,
                message: "超24h未处理催办任务，涉及 1 条周报",
                createdAt: "2026-03-11T08:00:00.000Z"
              }
            ]
          })
        } as Response;
      }
      if (url.includes("/api/weekly-reports/review-nudges") && method === "POST") {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: 9901,
            level: "SLA24",
            status: "PENDING",
            channel: "LOCAL_PLACEHOLDER",
            targetCount: 1,
            message: "超24h未处理催办任务，涉及 1 条周报",
            createdAt: "2026-03-11T08:00:00.000Z"
          })
        } as Response;
      }
      if (url.includes("/api/weekly-reports/review-nudges/9901") && method === "PATCH") {
        nudgeStatus = "SENT";
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 9901,
            level: "SLA24",
            status: "SENT",
            channel: "LOCAL_PLACEHOLDER",
            targetCount: 1,
            message: "超24h未处理催办任务，涉及 1 条周报",
            createdAt: "2026-03-11T08:00:00.000Z"
          })
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response;
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText("催办队列")).toBeInTheDocument();
      expect(screen.getByText("暂无催办任务")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "一键催办（占位）" }));
    await waitFor(() => {
      expect(screen.getByText("#9901 SLA24 / 1条 / PENDING")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "标记已发送" }));
    await waitFor(() => {
      expect(screen.getByText("催办任务 #9901 状态已更新为 SENT")).toBeInTheDocument();
      expect(screen.getByText("#9901 SLA24 / 1条 / SENT")).toBeInTheDocument();
    });
  });

  it("supports nudge queue status filter and batch retry", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 1741, thisWeekText: "nudge-batch", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
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
              id: 9911,
              level: "SLA24",
              status: "FAILED",
              channel: "LOCAL_PLACEHOLDER",
              targetCount: 1,
              message: "失败任务",
              createdAt: "2026-03-11T08:00:00.000Z"
            }
          ],
          total: 1,
          page: 1,
          pageSize: 5
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 9911,
              level: "SLA24",
              status: "FAILED",
              channel: "LOCAL_PLACEHOLDER",
              targetCount: 1,
              message: "失败任务",
              createdAt: "2026-03-11T08:00:00.000Z"
            }
          ],
          total: 1,
          page: 1,
          pageSize: 5
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ count: 1 })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 9911,
              level: "SLA24",
              status: "PENDING",
              channel: "LOCAL_PLACEHOLDER",
              targetCount: 1,
              message: "失败任务",
              createdAt: "2026-03-11T08:00:00.000Z"
            }
          ],
          total: 1,
          page: 1,
          pageSize: 5
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "刷新催办队列" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "刷新催办队列" }));
    await waitFor(() => {
      expect(screen.getByText("#9911 SLA24 / 1条 / FAILED")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("催办状态筛选"), { target: { value: "FAILED" } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports/review-nudges?page=1&pageSize=5&status=FAILED",
        expect.objectContaining({ method: "GET" })
      );
    });

    fireEvent.click(screen.getByLabelText("选择催办任务-9911"));
    fireEvent.click(screen.getByRole("button", { name: "批量重试" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports/review-nudges/retry-batch",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ ids: [9911] })
        })
      );
      expect(screen.getByText("已批量重试 1 条催办任务")).toBeInTheDocument();
    });
  });

  it("applies saved default list filters on initial load", async () => {
    window.localStorage.setItem(
      "manager_reviews_list_filter_defaults_v1",
      JSON.stringify({
        pageSize: 50,
        overdueFirst: true,
        mentionLeaderOnly: true,
        mentionFirst: true,
        myDirectOnly: true
      })
    );

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 959, thisWeekText: "默认筛选命中", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 50
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=50&overdueFirst=true&mentionLeaderOnly=true&mentionFirst=true&myDirectOnly=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("can save current filters as defaults and restore them", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 960, thisWeekText: "保存默认", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 960, thisWeekText: "保存默认", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("保存默认")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "逾期优先" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "@领导提醒" }));
    fireEvent.click(screen.getByRole("button", { name: "保存为默认筛选" }));

    const savedRaw = window.localStorage.getItem("manager_reviews_list_filter_defaults_v1");
    expect(savedRaw).toBeTruthy();
    const saved = JSON.parse(savedRaw || "{}");
    expect(saved.overdueFirst).toBe(true);
    expect(saved.mentionLeaderOnly).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    fireEvent.click(screen.getByRole("button", { name: "恢复默认筛选" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=20&overdueFirst=true&mentionLeaderOnly=true",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("loads filter options and supports active filter tags clear all", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 961, thisWeekText: "筛选标签", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
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
          departments: [{ id: 10, name: "研发部" }],
          leaders: [{ id: 20, username: "leader20", realName: "李经理" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 962, thisWeekText: "筛选后", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 963, thisWeekText: "清空后", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("筛选标签")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "加载筛选项" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports/filter-options?status=PENDING_APPROVAL",
        expect.objectContaining({ method: "GET" })
      );
    });

    fireEvent.change(screen.getByLabelText("部门筛选"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("直属领导筛选"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "查询" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "直属领导：李经理（leader20） ×" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "清空全部筛选" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "清空全部筛选" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports?status=PENDING_APPROVAL",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("supports filtering department and leader options by keyword", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 971, thisWeekText: "选项搜索", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
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
          departments: [
            { id: 100, name: "研发中心" },
            { id: 101, name: "市场部" }
          ],
          leaders: [
            { id: 201, username: "zhangsan", realName: "张三" },
            { id: 202, username: "lisi", realName: "李四" }
          ]
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("选项搜索")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "加载筛选项" }));
    await waitFor(() => {
      expect(screen.getByLabelText("部门筛选")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("部门选项搜索"), { target: { value: "研发" } });
    expect(screen.getByRole("option", { name: "研发中心" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "市场部" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("直属领导选项搜索"), { target: { value: "李" } });
    expect(screen.getByRole("option", { name: "李四（lisi）" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "张三（zhangsan）" })).not.toBeInTheDocument();
  });

  it("uses fresh filter options cache and supports manual refresh", async () => {
    const fetchedAt = new Date().toISOString();
    window.localStorage.setItem(
      "manager_reviews_filter_options_cache_v1",
      JSON.stringify({
        departments: [{ id: 301, name: "缓存部门" }],
        leaders: [{ id: 401, username: "cache_leader", realName: "缓存领导" }],
        fetchedAt
      })
    );

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 981, thisWeekText: "缓存筛选项", status: "PENDING_APPROVAL" }],
          total: 1,
          page: 1,
          pageSize: 20
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
          departments: [{ id: 302, name: "刷新后部门" }],
          leaders: [{ id: 402, username: "refreshed", realName: "刷新后领导" }]
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("缓存筛选项")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "刷新筛选项" })).toBeInTheDocument();
      expect(screen.getByText(/筛选项刷新：/)).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "缓存部门" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "缓存领导（cache_leader）" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "刷新筛选项" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekly-reports/filter-options?status=PENDING_APPROVAL",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("exports current logs as csv", async () => {
    const createObjectURL = jest.fn(() => "blob:weekly-report");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 81, thisWeekText: "导出日志", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 8001,
              action: "REVIEW_APPROVED",
              targetId: "81",
              createdAt: "2026-03-20T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
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
              id: 8001,
              action: "REVIEW_APPROVED",
              targetId: "81",
              createdAt: "2026-03-20T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("导出日志")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "导出CSV" }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:weekly-report");
    });
  });

  it("exports csv with current filters and date range in filename", async () => {
    const createObjectURL = jest.fn(() => "blob:weekly-report");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 91, thisWeekText: "导出筛选", status: "PENDING_APPROVAL" }]
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
              id: 9001,
              action: "REVIEW_REJECTED",
              targetId: "91",
              createdAt: "2026-03-20T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("导出筛选")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("日志结果筛选"), {
      target: { value: "REJECTED" }
    });
    fireEvent.change(screen.getByLabelText("日志审批人筛选"), {
      target: { value: "admin" }
    });
    fireEvent.change(screen.getByLabelText("日志开始日期筛选"), {
      target: { value: "2026-03-01" }
    });
    fireEvent.change(screen.getByLabelText("日志结束日期筛选"), {
      target: { value: "2026-03-20" }
    });
    fireEvent.click(screen.getByRole("button", { name: "导出CSV" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/audit-logs/reviews?limit=100&decision=REJECTED&actorKeyword=admin&dateFrom=2026-03-01&dateTo=2026-03-20",
        expect.objectContaining({ method: "GET" })
      );
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const firstAnchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(firstAnchor.download).toBe("approval-logs-2026-03-01_to_2026-03-20.csv");
  });

  it("exports selected fields with gbk encoding option", async () => {
    const createObjectURL = jest.fn(() => "blob:weekly-report");
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: jest.fn(),
      configurable: true
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 101, thisWeekText: "字段导出", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 10001,
              action: "REVIEW_APPROVED",
              targetId: "101",
              createdAt: "2026-03-20T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
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
              id: 10001,
              action: "REVIEW_APPROVED",
              targetId: "101",
              createdAt: "2026-03-20T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("字段导出")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("导出字段-时间"));
    fireEvent.change(screen.getByLabelText("导出编码"), {
      target: { value: "gbk" }
    });
    fireEvent.click(screen.getByRole("button", { name: "导出CSV" }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    const firstAnchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(firstAnchor.download).toBe("approval-logs-all-gbk.csv");
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toContain("charset=gbk");
    expect(blobArg.size).toBeGreaterThan(0);
  });

  it("applies export presets and affects exported filename and payload", async () => {
    const createObjectURL = jest.fn(() => "blob:weekly-report");
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: jest.fn(),
      configurable: true
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 111, thisWeekText: "预设导出", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 11001,
              action: "REVIEW_REJECTED",
              targetId: "111",
              createdAt: "2026-03-20T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
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
              id: 11001,
              action: "REVIEW_REJECTED",
              targetId: "111",
              createdAt: "2026-03-20T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("预设导出")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "审计版预设" }));
    expect((screen.getByLabelText("导出字段-时间") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("导出字段-审批人") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("导出字段-动作") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("导出字段-周报ID") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("导出编码") as HTMLSelectElement).value).toBe("gbk");

    fireEvent.click(screen.getByRole("button", { name: "导出CSV" }));
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    });
    let firstAnchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(firstAnchor.download).toBe("approval-logs-all-gbk.csv");

    fireEvent.click(screen.getByRole("button", { name: "复盘版预设" }));
    expect((screen.getByLabelText("导出字段-时间") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("导出字段-审批人") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("导出字段-动作") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("导出字段-周报ID") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("导出编码") as HTMLSelectElement).value).toBe("utf-8");

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 11001,
            action: "REVIEW_REJECTED",
            targetId: "111",
            createdAt: "2026-03-20T08:00:00.000Z",
            actor: { id: 1, username: "admin", realName: "系统管理员" }
          }
        ]
      })
    });
    fireEvent.click(screen.getByRole("button", { name: "导出CSV" }));
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(2);
    });
    firstAnchor = clickSpy.mock.instances[1] as HTMLAnchorElement;
    expect(firstAnchor.download).toBe("approval-logs-all.csv");
  });

  it("restores export preferences from localStorage on load", async () => {
    window.localStorage.setItem(
      "manager_reviews_export_preferences",
      JSON.stringify({
        columns: { time: false, actor: true, action: true, targetId: false },
        encoding: "gbk",
        diffExportMaskSensitive: false
      })
    );

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 121, thisWeekText: "恢复偏好", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("恢复偏好")).toBeInTheDocument();
    });

    expect((screen.getByLabelText("导出字段-时间") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("导出字段-审批人") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("导出字段-动作") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("导出字段-周报ID") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("导出编码") as HTMLSelectElement).value).toBe("gbk");
    expect((screen.getByLabelText("导出差异TXT脱敏") as HTMLInputElement).checked).toBe(false);
  });

  it("persists export preferences when user changes settings", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 131, thisWeekText: "保存偏好", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("保存偏好")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "复盘版预设" }));

    const raw = window.localStorage.getItem("manager_reviews_export_preferences");
    expect(raw).not.toBeNull();
    const prefs = JSON.parse(raw as string) as {
      columns: { time: boolean; actor: boolean; action: boolean; targetId: boolean };
      encoding: string;
      diffExportMaskSensitive: boolean;
    };
    expect(prefs.columns.time).toBe(true);
    expect(prefs.columns.actor).toBe(false);
    expect(prefs.columns.action).toBe(true);
    expect(prefs.columns.targetId).toBe(true);
    expect(prefs.encoding).toBe("utf-8");
    expect(prefs.diffExportMaskSensitive).toBe(true);
  });

  it("persists diff export mask toggle and restores on rerender", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 132, thisWeekText: "脱敏偏好持久化", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    const view = render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("脱敏偏好持久化")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("导出差异TXT脱敏") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);

    const raw = window.localStorage.getItem("manager_reviews_export_preferences");
    expect(raw).not.toBeNull();
    const prefs = JSON.parse(raw as string) as {
      diffExportMaskSensitive?: boolean;
    };
    expect(prefs.diffExportMaskSensitive).toBe(false);

    view.unmount();
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 133, thisWeekText: "二次加载", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("二次加载")).toBeInTheDocument();
    });
    expect((screen.getByLabelText("导出差异TXT脱敏") as HTMLInputElement).checked).toBe(false);
  });

  it("shows export task history and supports re-download", async () => {
    window.localStorage.setItem(
      "manager_reviews_export_history",
      JSON.stringify([
        {
          id: "history-1",
          fileName: "approval-logs-all.csv",
          createdAt: "2026-03-20T10:00:00.000Z",
          content: "\"时间\",\"动作\"\n\"03/20 18:00\",\"通过\"",
          mimeType: "text/csv;charset=utf-8;"
        }
      ])
    );

    const createObjectURL = jest.fn(() => "blob:weekly-report");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 141, thisWeekText: "历史下载", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("历史下载")).toBeInTheDocument();
      expect(screen.getByText("approval-logs-all.csv")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "重新下载-approval-logs-all.csv" }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:weekly-report");
    });
  });

  it("supports deleting one export history item and clearing all history", async () => {
    window.localStorage.setItem(
      "manager_reviews_export_history",
      JSON.stringify([
        {
          id: "history-1",
          fileName: "approval-logs-one.csv",
          createdAt: "2026-03-20T10:00:00.000Z",
          content: "\"时间\",\"动作\"\n\"03/20 18:00\",\"通过\"",
          mimeType: "text/csv;charset=utf-8;"
        },
        {
          id: "history-2",
          fileName: "approval-logs-two.csv",
          createdAt: "2026-03-20T11:00:00.000Z",
          content: "\"时间\",\"动作\"\n\"03/20 19:00\",\"驳回\"",
          mimeType: "text/csv;charset=utf-8;"
        }
      ])
    );

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 151, thisWeekText: "清理历史", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("approval-logs-one.csv")).toBeInTheDocument();
      expect(screen.getByText("approval-logs-two.csv")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "删除记录-approval-logs-one.csv" }));
    await waitFor(() => {
      expect(screen.queryByText("approval-logs-one.csv")).not.toBeInTheDocument();
      expect(screen.getByText("approval-logs-two.csv")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "清空导出记录" }));
    await waitFor(() => {
      expect(screen.getByText("暂无导出记录")).toBeInTheDocument();
    });

    const raw = window.localStorage.getItem("manager_reviews_export_history");
    expect(raw).toBe("[]");
  });

  it("supports searching and paginating export history", async () => {
    window.localStorage.setItem(
      "manager_reviews_export_history",
      JSON.stringify(
        Array.from({ length: 7 }).map((_, idx) => ({
          id: `history-${idx + 1}`,
          fileName: `approval-logs-${idx + 1}.csv`,
          createdAt: "2026-03-20T10:00:00.000Z",
          content: "\"时间\",\"动作\"\n\"03/20 18:00\",\"通过\"",
          mimeType: "text/csv;charset=utf-8;"
        }))
      )
    );

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 161, thisWeekText: "分页搜索", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("approval-logs-1.csv")).toBeInTheDocument();
      expect(screen.queryByText("approval-logs-6.csv")).not.toBeInTheDocument();
      expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => {
      expect(screen.getByText("approval-logs-6.csv")).toBeInTheDocument();
      expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("导出记录搜索"), {
      target: { value: "approval-logs-7" }
    });
    await waitFor(() => {
      expect(screen.getByText("approval-logs-7.csv")).toBeInTheDocument();
      expect(screen.queryByText("approval-logs-6.csv")).not.toBeInTheDocument();
      expect(screen.getByText("第 1 / 1 页")).toBeInTheDocument();
    });
  });

  it("supports sorting export history by time and filename", async () => {
    window.localStorage.setItem(
      "manager_reviews_export_history",
      JSON.stringify([
        {
          id: "history-a",
          fileName: "approval-logs-b.csv",
          createdAt: "2026-03-20T10:00:00.000Z",
          content: "a",
          mimeType: "text/csv;charset=utf-8;"
        },
        {
          id: "history-b",
          fileName: "approval-logs-a.csv",
          createdAt: "2026-03-20T11:00:00.000Z",
          content: "b",
          mimeType: "text/csv;charset=utf-8;"
        }
      ])
    );

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 171, thisWeekText: "排序", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("approval-logs-b.csv")).toBeInTheDocument();
      expect(screen.getByText("approval-logs-a.csv")).toBeInTheDocument();
    });

    let redownloadButtons = screen.getAllByText("重新下载");
    let firstRowText = redownloadButtons[0].closest("li")?.textContent || "";
    expect(firstRowText).toContain("approval-logs-a.csv");

    fireEvent.change(screen.getByLabelText("导出记录排序字段"), {
      target: { value: "fileName" }
    });
    redownloadButtons = screen.getAllByText("重新下载");
    firstRowText = redownloadButtons[0].closest("li")?.textContent || "";
    expect(firstRowText).toContain("approval-logs-b.csv");

    fireEvent.click(screen.getByRole("button", { name: "切换排序方向" }));

    redownloadButtons = screen.getAllByText("重新下载");
    firstRowText = redownloadButtons[0].closest("li")?.textContent || "";
    expect(firstRowText).toContain("approval-logs-a.csv");
  });

  it("shows history filter tags and can reuse filters for export", async () => {
    const createObjectURL = jest.fn(() => "blob:weekly-report");
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: jest.fn(),
      configurable: true
    });
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    window.localStorage.setItem(
      "manager_reviews_export_history",
      JSON.stringify([
        {
          id: "history-reuse-1",
          fileName: "approval-logs-reuse.csv",
          createdAt: "2026-03-20T11:00:00.000Z",
          content: "\"动作\",\"周报ID\"\n\"驳回\",\"#1\"",
          mimeType: "text/csv;charset=utf-8;",
          filters: {
            decision: "REJECTED",
            actorKeyword: "admin",
            dateFrom: "2026-03-01",
            dateTo: "2026-03-20"
          },
          columns: { time: false, actor: false, action: true, targetId: true },
          encoding: "utf-8"
        }
      ])
    );

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 181, thisWeekText: "复用导出", status: "PENDING_APPROVAL" }]
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
              id: 18001,
              action: "REVIEW_REJECTED",
              targetId: "181",
              createdAt: "2026-03-20T08:00:00.000Z",
              actor: { id: 1, username: "admin", realName: "系统管理员" }
            }
          ]
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("复用导出")).toBeInTheDocument();
      expect(screen.getByText("结果: 仅驳回")).toBeInTheDocument();
      expect(screen.getByText("审批人: admin")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "复用筛选并导出-approval-logs-reuse.csv" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/audit-logs/reviews?limit=100&decision=REJECTED&actorKeyword=admin&dateFrom=2026-03-01&dateTo=2026-03-20",
        expect.objectContaining({ method: "GET" })
      );
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    });
  });

  it("supports saving named templates, pinning to top and applying template export", async () => {
    const createObjectURL = jest.fn(() => "blob:weekly-report");
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: jest.fn(),
      configurable: true
    });
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 191, thisWeekText: "模板收藏", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=100&decision=APPROVED") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 19001,
                action: "REVIEW_APPROVED",
                targetId: "191",
                createdAt: "2026-03-20T08:00:00.000Z",
                actor: { id: 1, username: "admin", realName: "系统管理员" }
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/sync") {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ items: [] })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({})
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("模板收藏")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("日志结果筛选"), {
      target: { value: "APPROVED" }
    });
    fireEvent.change(screen.getByLabelText("模板名称"), {
      target: { value: "周会复盘模板" }
    });
    fireEvent.click(screen.getByRole("button", { name: "收藏当前配置为模板" }));

    await waitFor(() => {
      expect(screen.getByText("周会复盘模板")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板名称"), {
      target: { value: "审计模板" }
    });
    fireEvent.click(screen.getByRole("button", { name: "审计版预设" }));
    fireEvent.click(screen.getByRole("button", { name: "收藏当前配置为模板" }));

    await waitFor(() => {
      expect(screen.getByText("审计模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "置顶模板-周会复盘模板" }));
    const templateRows = screen.getAllByTestId("export-template-item");
    expect(templateRows[0].textContent).toContain("周会复盘模板");

    fireEvent.click(screen.getByRole("button", { name: "应用模板并导出-周会复盘模板" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/audit-logs/reviews?limit=100&decision=APPROVED",
        expect.objectContaining({ method: "GET" })
      );
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    });
  });

  it("supports searching, renaming and deleting templates", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 201, thisWeekText: "模板维护", status: "PENDING_APPROVAL" }]
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
              id: "tpl-1",
              name: "周会复盘模板",
              createdAt: "2026-03-20T10:00:00.000Z",
              pinned: false,
              filters: { decision: "APPROVED", actorKeyword: "", dateFrom: "", dateTo: "" },
              columns: { time: true, actor: false, action: true, targetId: true },
              encoding: "utf-8"
            },
            {
              id: "tpl-2",
              name: "审计模板",
              createdAt: "2026-03-20T11:00:00.000Z",
              pinned: true,
              filters: { decision: "REJECTED", actorKeyword: "admin", dateFrom: "", dateTo: "" },
              columns: { time: true, actor: true, action: true, targetId: true },
              encoding: "gbk"
            }
          ]
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("周会复盘模板")).toBeInTheDocument();
      expect(screen.getByText("审计模板")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板搜索"), {
      target: { value: "审计" }
    });
    await waitFor(() => {
      expect(screen.queryByText("周会复盘模板")).not.toBeInTheDocument();
      expect(screen.getByText("审计模板")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板新名称-审计模板"), {
      target: { value: "审计模板V2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "重命名模板-审计模板" }));
    await waitFor(() => {
      expect(screen.getByText("审计模板V2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "删除模板-审计模板V2" }));
    await waitFor(() => {
      expect(screen.queryByText("审计模板V2")).not.toBeInTheDocument();
      expect(screen.getByText("暂无模板")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/audit-logs/review-templates/tpl-2",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("supports quick toggle template diff mask default from template list", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 205, thisWeekText: "模板脱敏快捷切换", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            item: {
              id: "tpl-mask-1",
              name: "掩码模板",
              createdAt: "2026-03-20T11:00:00.000Z",
              pinned: false,
              diffExportMaskSensitive: false,
              filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
              columns: { time: true, actor: true, action: true, targetId: true },
              encoding: "utf-8"
            }
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-mask-1",
                name: "掩码模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("模板脱敏快捷切换")).toBeInTheDocument();
      expect(screen.getByText("掩码模板")).toBeInTheDocument();
      expect(screen.getByText("差异TXT默认：脱敏（跟随全局）")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "切换模板脱敏默认-掩码模板" })).toHaveTextContent(
        "设为原文"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "切换模板脱敏默认-掩码模板" }));
    await waitFor(() => {
      expect(screen.getByText("差异TXT默认：原文")).toBeInTheDocument();
      expect(screen.getByText("模板差异TXT默认已更新为原文")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "切换模板脱敏默认-掩码模板" })).toHaveTextContent(
        "设为脱敏"
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/audit-logs/review-templates",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("\"diffExportMaskSensitive\":false")
        })
      );
    });
  });

  it("does not toggle template diff mask default when confirmation is cancelled", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 206, thisWeekText: "模板脱敏取消确认", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-mask-2",
                name: "掩码模板取消",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("模板脱敏取消确认")).toBeInTheDocument();
      expect(screen.getByText("掩码模板取消")).toBeInTheDocument();
      expect(screen.getByText("差异TXT默认：脱敏（跟随全局）")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "切换模板脱敏默认-掩码模板取消" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByText("差异TXT默认：脱敏（跟随全局）")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/audit-logs/review-templates",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("supports exporting and importing templates via json", async () => {
    const createObjectURL = jest.fn(() => "blob:weekly-templates");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 211, thisWeekText: "模板导入导出", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("模板导入导出")).toBeInTheDocument();
      expect(
        screen.getByText("模板JSON字段说明：diffExportMaskSensitive=true（脱敏）、false（原文）")
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板名称"), {
      target: { value: "本地模板" }
    });
    fireEvent.click(screen.getByRole("button", { name: "收藏当前配置为模板" }));
    await waitFor(() => {
      expect(screen.getByText("本地模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "导出模板JSON" }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const firstAnchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(firstAnchor.download).toBe("export-templates.json");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:weekly-templates");
    const exportBlob = createObjectURL.mock.calls[0][0] as Blob;
    const exportText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read blob failed"));
      reader.readAsText(exportBlob);
    });
    expect(exportText).toContain("\"diffExportMaskSensitive\": true");

    const imported = JSON.stringify([
      {
        id: "import-1",
        name: "外部模板",
        createdAt: "2026-03-20T12:00:00.000Z",
        pinned: false,
        diffExportMaskSensitive: false,
        filters: { decision: "REJECTED", actorKeyword: "admin", dateFrom: "", dateTo: "" },
        columns: { time: true, actor: true, action: true, targetId: true },
        encoding: "gbk"
      }
    ]);
    fireEvent.change(screen.getByLabelText("模板JSON内容"), {
      target: { value: imported }
    });
    fireEvent.click(screen.getByRole("button", { name: "导入模板JSON" }));

    await waitFor(() => {
      expect(screen.getByText("外部模板")).toBeInTheDocument();
    });
  });

  it("supports conflict strategy when importing templates", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 221, thisWeekText: "冲突导入", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("冲突导入")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板名称"), {
      target: { value: "本地模板" }
    });
    fireEvent.click(screen.getByRole("button", { name: "收藏当前配置为模板" }));
    await waitFor(() => {
      expect(screen.getByText("本地模板")).toBeInTheDocument();
    });

    const duplicated = JSON.stringify([
      {
        id: "import-dup-1",
        name: "本地模板",
        createdAt: "2026-03-20T12:00:00.000Z",
        pinned: true,
        filters: { decision: "REJECTED", actorKeyword: "", dateFrom: "", dateTo: "" },
        columns: { time: true, actor: true, action: true, targetId: true },
        encoding: "gbk"
      }
    ]);
    fireEvent.change(screen.getByLabelText("模板JSON内容"), {
      target: { value: duplicated }
    });
    fireEvent.click(screen.getByRole("button", { name: "导入模板JSON" }));

    await waitFor(() => {
      expect(screen.getByText("检测到 1 个同名模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "跳过同名并导入" }));
    await waitFor(() => {
      expect(screen.queryByText("[已置顶]")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "导入模板JSON" }));
    await waitFor(() => {
      expect(screen.getByText("检测到 1 个同名模板")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "覆盖同名并导入" }));

    await waitFor(() => {
      expect(screen.getByText("[已置顶]")).toBeInTheDocument();
    });
  });

  it("shows precise validation message when template json is invalid", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 231, thisWeekText: "校验定位", status: "PENDING_APPROVAL" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }) as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("校验定位")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板JSON内容"), {
      target: { value: '{"name":"not-array"}' }
    });
    fireEvent.click(screen.getByRole("button", { name: "导入模板JSON" }));
    await waitFor(() => {
      expect(screen.getByText("模板JSON格式不正确：根节点必须是数组")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板JSON内容"), {
      target: { value: '[{"name":"ok"},{"id":"missing-name"}]' }
    });
    fireEvent.click(screen.getByRole("button", { name: "导入模板JSON" }));
    await waitFor(() => {
      expect(screen.getByText("模板JSON格式不正确：第 2 条缺少 name")).toBeInTheDocument();
    });
  });

  it("uses incremental template apis for create update and delete", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 241, thisWeekText: "增量模板接口", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url.startsWith("/api/audit-logs/review-templates/") && init?.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        } as Response);
      }
      if (url.startsWith("/api/audit-logs/review-templates/") && init?.method === "PATCH") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            item: {
              id: "tpl-inc-1",
              name: "增量模板V2",
              createdAt: "2026-03-20T12:00:00.000Z",
              pinned: false,
              filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
              columns: { time: true, actor: true, action: true, targetId: true },
              encoding: "utf-8"
            }
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            item: {
              id: "tpl-inc-1",
              name: "增量模板",
              createdAt: "2026-03-20T12:00:00.000Z",
              pinned: false,
              filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
              columns: { time: true, actor: true, action: true, targetId: true },
              encoding: "utf-8"
            }
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({})
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("增量模板接口")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板名称"), {
      target: { value: "增量模板" }
    });
    fireEvent.click(screen.getByRole("button", { name: "收藏当前配置为模板" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/audit-logs/review-templates",
        expect.objectContaining({ method: "POST" })
      );
    });

  });

  it("super admin can switch template owner scope", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 251, thisWeekText: "跨用户模板", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates?ownerUserId=99") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-owner-99",
                name: "用户99模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("跨用户模板")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板用户ID"), {
      target: { value: "99" }
    });
    fireEvent.click(screen.getByRole("button", { name: "切换用户模板" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/audit-logs/review-templates?ownerUserId=99",
        expect.objectContaining({ method: "GET" })
      );
      expect(screen.getByText("用户99模板")).toBeInTheDocument();
    });
  });

  it("supports template version history and rollback", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 261, thisWeekText: "版本回滚", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-1",
                name: "历史模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-1/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 301,
                templateId: "tpl-version-1",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "历史模板",
                pinned: false,
                filters: { decision: "APPROVED", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-1/rollback" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            item: {
              id: "tpl-version-1",
              name: "历史模板",
              createdAt: "2026-03-20T12:00:00.000Z",
              pinned: false,
              filters: { decision: "APPROVED", actorKeyword: "", dateFrom: "", dateTo: "" },
              columns: { time: true, actor: true, action: true, targetId: true },
              encoding: "utf-8"
            }
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("版本回滚")).toBeInTheDocument();
      expect(screen.getByText("历史模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-历史模板" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "回滚模板版本-历史模板-301" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "回滚模板版本-历史模板-301" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/audit-logs/review-templates/tpl-version-1/rollback",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows rollback confirmation and allows cancel", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 271, thisWeekText: "回滚确认", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-2",
                name: "确认模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-2/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 401,
                templateId: "tpl-version-2",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "确认模板",
                pinned: false,
                filters: { decision: "REJECTED", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("确认模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-确认模板" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "回滚模板版本-确认模板-401" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "回滚模板版本-确认模板-401" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/audit-logs/review-templates/tpl-version-2/rollback",
      expect.anything()
    );
  });

  it("shows version diff summary against current template", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 281, thisWeekText: "版本差异", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-3",
                name: "差异模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-3/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 501,
                templateId: "tpl-version-3",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "差异模板旧版",
                pinned: true,
                filters: { decision: "APPROVED", actorKeyword: "张三", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: false, action: true, targetId: true },
                encoding: "gbk"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("差异模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-差异模板" }));
    await waitFor(() => {
      expect(screen.getByText(/与当前差异：/)).toBeInTheDocument();
      expect(screen.getByText(/名称、置顶、筛选条件、导出字段、编码/)).toBeInTheDocument();
    });
  });

  it("can expand version diff details with field-level current and history values", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 282, thisWeekText: "差异详情", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-4",
                name: "当前模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-4/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 601,
                templateId: "tpl-version-4",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "历史模板",
                pinned: true,
                filters: { decision: "APPROVED", actorKeyword: "李四", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: false, action: true, targetId: true },
                encoding: "gbk"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("当前模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-当前模板" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "查看差异详情-当前模板-601" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "查看差异详情-当前模板-601" }));
    await waitFor(() => {
      expect(screen.getByText("字段：名称")).toBeInTheDocument();
      expect(screen.getByText("当前：当前模板")).toBeInTheDocument();
      expect(screen.getByText("历史：历史模板")).toBeInTheDocument();
      expect(screen.getByText("字段：筛选条件")).toBeInTheDocument();
      expect(screen.getByText(/当前：结果：全部，审批人关键词：无，开始日期：未设置，结束日期：未设置/)).toBeInTheDocument();
      expect(screen.getByText(/历史：结果：仅通过，审批人关键词：李四，开始日期：未设置，结束日期：未设置/)).toBeInTheDocument();
      expect(screen.getByText("字段：导出字段")).toBeInTheDocument();
      expect(screen.getByText(/当前：时间：是，审批人：是，动作：是，周报ID：是/)).toBeInTheDocument();
      expect(screen.getByText(/历史：时间：是，审批人：否，动作：是，周报ID：是/)).toBeInTheDocument();
      expect(screen.getByText("字段：编码")).toBeInTheDocument();
      expect(screen.getByText("当前：utf-8")).toBeInTheDocument();
      expect(screen.getByText("历史：gbk")).toBeInTheDocument();
    });
  });

  it("highlights changed diff rows and supports expanding long diff value text", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 283, thisWeekText: "高亮与折叠", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-5",
                name: "当前模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-5/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 701,
                templateId: "tpl-version-5",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "当前模板",
                pinned: false,
                filters: {
                  decision: "REJECTED",
                  actorKeyword: "这是一个非常非常长的审批人关键词用于验证差异文本折叠展开能力",
                  dateFrom: "",
                  dateTo: ""
                },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("高亮与折叠")).toBeInTheDocument();
      expect(screen.getByText("当前模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-当前模板" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "查看差异详情-当前模板-701" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "查看差异详情-当前模板-701" }));

    await waitFor(() => {
      expect(screen.getByTestId("template-diff-row-tpl-version-5-701-筛选条件")).toBeInTheDocument();
      expect(screen.getByText(/历史：结果：仅驳回，审批人关键词：这是一个非常非常长的审批人关键词用于验证/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "展开差异值-当前模板-701-筛选条件-history"
        })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "展开差异值-当前模板-701-筛选条件-history"
      })
    );
    await waitFor(() => {
      expect(
        screen.getByText(/历史：结果：仅驳回，审批人关键词：这是一个非常非常长的审批人关键词用于验证差异文本折叠展开能力/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "收起差异值-当前模板-701-筛选条件-history"
        })
      ).toBeInTheDocument();
    });
  });

  it("orders diff detail rows by priority", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 284, thisWeekText: "差异排序", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-6",
                name: "当前模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-6/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 801,
                templateId: "tpl-version-6",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "历史模板",
                pinned: true,
                filters: { decision: "REJECTED", actorKeyword: "王五", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: false, action: true, targetId: true },
                encoding: "gbk"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("差异排序")).toBeInTheDocument();
      expect(screen.getByText("当前模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-当前模板" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "查看差异详情-当前模板-801" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "查看差异详情-当前模板-801" }));

    await waitFor(() => {
      const rows = screen.getAllByTestId(/template-diff-row-tpl-version-6-801-/);
      expect(rows[0].textContent).toContain("字段：编码");
      expect(rows[1].textContent).toContain("字段：筛选条件");
      expect(rows[2].textContent).toContain("字段：导出字段");
      expect(rows[3].textContent).toContain("字段：名称");
      expect(rows[4].textContent).toContain("字段：置顶");
    });
  });

  it("copies diff detail text to clipboard", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 285, thisWeekText: "复制差异", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-7",
                name: "当前模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-7/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 901,
                templateId: "tpl-version-7",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "历史模板",
                pinned: true,
                filters: { decision: "APPROVED", actorKeyword: "赵六", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: false, action: true, targetId: true },
                encoding: "gbk"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("复制差异")).toBeInTheDocument();
      expect(screen.getByText("当前模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-当前模板" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "复制差异详情-当前模板-901" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "复制差异详情-当前模板-901" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0][0]).toMatch(/模板：当前模板/);
      expect(writeText.mock.calls[0][0]).toMatch(/版本：#901/);
      expect(writeText.mock.calls[0][0]).toMatch(/字段：编码/);
      expect(screen.getByText("差异内容已复制")).toBeInTheDocument();
    });
  });

  it("exports diff detail as txt file", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 286, thisWeekText: "导出差异TXT", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-8",
                name: "当前模板",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-8/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 1001,
                templateId: "tpl-version-8",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "历史模板",
                pinned: true,
                filters: { decision: "APPROVED", actorKeyword: "孙七", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: false, action: true, targetId: true },
                encoding: "gbk"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const createObjectURL = jest.fn(() => "blob:template-diff");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("导出差异TXT")).toBeInTheDocument();
      expect(screen.getByText("当前模板")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-当前模板" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "导出差异详情TXT-当前模板-1001" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "导出差异详情TXT-当前模板-1001" }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:template-diff");
    });

    const clickedAnchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(clickedAnchor.download).toBe("template-diff-tpl-version-8-v1001.txt");
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    const blobText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read blob failed"));
      reader.readAsText(blobArg);
    });
    expect(blobText).toContain("导出时间：");
    expect(blobText).toContain("模板ID：tpl-version-8");
    expect(blobText).toContain("模板名称：当前模板");
    expect(blobText).toContain("版本ID：1001");
    expect(blobText).toContain("敏感信息处理：已脱敏");
    expect(blobText).toContain("审批人关键词：孙*");
    expect(blobText).toContain("字段：编码");
  });

  it("exports diff detail as txt file without masking when toggle is off", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 287, thisWeekText: "导出差异TXT不脱敏", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-9",
                name: "当前模板B",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-9/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 1002,
                templateId: "tpl-version-9",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "历史模板B",
                pinned: true,
                filters: { decision: "APPROVED", actorKeyword: "孙七", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: false, action: true, targetId: true },
                encoding: "gbk"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const createObjectURL = jest.fn(() => "blob:template-diff");
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: jest.fn(),
      configurable: true
    });
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("导出差异TXT不脱敏")).toBeInTheDocument();
      expect(screen.getByText("当前模板B")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("导出差异TXT脱敏"));
    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-当前模板B" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "导出差异详情TXT-当前模板B-1002" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "导出差异详情TXT-当前模板B-1002" }));

    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    const blobText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read blob failed"));
      reader.readAsText(blobArg);
    });
    expect(blobText).toContain("敏感信息处理：原文");
    expect(blobText).toContain("审批人关键词：孙七");
  });

  it("uses template-level mask setting to override global diff export toggle", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 288, thisWeekText: "模板覆盖全局脱敏", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "tpl-version-10",
                name: "模板覆盖全局",
                createdAt: "2026-03-20T11:00:00.000Z",
                pinned: false,
                diffExportMaskSensitive: false,
                filters: { decision: "all", actorKeyword: "", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: true, action: true, targetId: true },
                encoding: "utf-8"
              }
            ]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates/tpl-version-10/versions") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 1003,
                templateId: "tpl-version-10",
                createdAt: "2026-03-20T10:00:00.000Z",
                name: "历史模板C",
                pinned: true,
                filters: { decision: "APPROVED", actorKeyword: "李四", dateFrom: "", dateTo: "" },
                columns: { time: true, actor: false, action: true, targetId: true },
                encoding: "gbk"
              }
            ]
          })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const createObjectURL = jest.fn(() => "blob:template-diff");
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: jest.fn(),
      configurable: true
    });
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("模板覆盖全局脱敏")).toBeInTheDocument();
      expect(screen.getByText("模板覆盖全局")).toBeInTheDocument();
      expect(screen.getByText("差异TXT默认：原文")).toBeInTheDocument();
    });

    expect((screen.getByLabelText("导出差异TXT脱敏") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "查看模板版本-模板覆盖全局" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "导出差异详情TXT-模板覆盖全局-1003" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "导出差异详情TXT-模板覆盖全局-1003" }));

    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    const blobText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read blob failed"));
      reader.readAsText(blobArg);
    });
    expect(blobText).toContain("敏感信息处理：原文");
    expect(blobText).toContain("审批人关键词：李四");
  });

  it("shows loading and empty state when switching super admin owner templates", async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/weekly-reports?status=PENDING_APPROVAL") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 291, thisWeekText: "切换加载态", status: "PENDING_APPROVAL" }]
          })
        } as Response);
      }
      if (url === "/api/audit-logs/reviews?limit=10") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        } as Response);
      }
      if (url === "/api/audit-logs/review-templates?ownerUserId=123") {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ items: [] })
            } as Response);
          }, 10);
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      } as Response);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("切换加载态")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("模板用户ID"), {
      target: { value: "123" }
    });
    fireEvent.click(screen.getByRole("button", { name: "切换用户模板" }));
    expect(screen.getByText("正在切换模板用户...")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("该用户暂无模板")).toBeInTheDocument();
    });
  });
});
