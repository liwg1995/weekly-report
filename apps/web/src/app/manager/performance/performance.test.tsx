import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManagerPerformancePage from "./page";
import { navigateTo } from "../../../lib/navigation";

jest.mock("../../../lib/navigation", () => ({
  navigateTo: jest.fn()
}));

describe("ManagerPerformancePage", () => {
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

  it("loads placeholder overview from api", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        cycles: [
          {
            id: 1,
            version: 1,
            name: "2026Q2 绩效周期（占位）",
            startDate: "2026-04-01T00:00:00.000Z",
            endDate: "2026-06-30T23:59:59.000Z",
            status: "DRAFT",
            dimensions: [
              {
                id: 11,
                version: 1,
                key: "delivery",
                name: "交付质量",
                weight: 40,
                metricHint: "按周报目标完成率与延期率评估"
              }
            ]
          }
        ],
        todos: [
          {
            id: 21,
            ownerRole: "SUPER_ADMIN",
            title: "确认评分维度与权重版本化策略",
            done: false
          }
        ]
      })
    } as Response) as typeof fetch;

    render(<ManagerPerformancePage />);

    await waitFor(() => {
      expect(screen.getByText("绩效考核（占位）")).toBeInTheDocument();
      expect(screen.getByText(/当前草案周期/)).toBeInTheDocument();
      expect(screen.getByText(/确认评分维度与权重版本化策略/)).toBeInTheDocument();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/performance/overview",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("redirects employee role to feedback page", async () => {
    window.localStorage.setItem(
      "sessionUser",
      JSON.stringify({ username: "alice", roles: ["EMPLOYEE"] })
    );

    render(<ManagerPerformancePage />);

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith("/employee/feedback");
    });
  });

  it("submits create-cycle form", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ cycles: [], todos: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 12 })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ cycles: [], todos: [] })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerPerformancePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("绩效周期名称")).toBeInTheDocument();
    });

    const cycleNameInput = screen.getByLabelText("绩效周期名称");
    const cycleStartInput = screen.getByLabelText("周期开始日期");
    const cycleEndInput = screen.getByLabelText("周期结束日期");
    const createButton = screen.getByRole("button", { name: "创建绩效周期" });

    fireEvent.change(cycleNameInput, { target: { value: "2026Q4" } });
    fireEvent.change(cycleStartInput, { target: { value: "2026-10-01" } });
    fireEvent.change(cycleEndInput, { target: { value: "2026-12-31" } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/performance/cycles",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("updates a performance cycle", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cycles: [
            {
              id: 12,
              version: 1,
              name: "2026Q2 绩效周期",
              startDate: "2026-04-01T00:00:00.000Z",
              endDate: "2026-06-30T23:59:59.000Z",
              status: "DRAFT",
              dimensions: []
            }
          ],
          todos: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cycles: [],
          todos: []
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerPerformancePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("编辑周期-12")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("编辑周期-12"));
    fireEvent.change(screen.getByLabelText("编辑周期名称-12"), {
      target: { value: "2026Q2 绩效周期（已改）" }
    });
    fireEvent.click(screen.getByLabelText("保存周期-12"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/performance/cycles/12",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("\"version\":1")
        })
      );
    });
  });

  it("deletes a performance cycle", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cycles: [
            {
              id: 13,
              version: 1,
              name: "待删周期",
              startDate: "2026-04-01T00:00:00.000Z",
              endDate: "2026-06-30T23:59:59.000Z",
              status: "DRAFT",
              dimensions: []
            }
          ],
          todos: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cycles: [],
          todos: []
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerPerformancePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("删除周期-13")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("删除周期-13"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/performance/cycles/13",
        expect.objectContaining({ method: "DELETE" })
      );
    });
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    confirmSpy.mockRestore();
  });

  it("updates a performance dimension", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cycles: [
            {
              id: 14,
              name: "2026Q2 绩效周期",
              startDate: "2026-04-01T00:00:00.000Z",
              endDate: "2026-06-30T23:59:59.000Z",
              status: "DRAFT",
              dimensions: [
                {
                  id: 141,
                  version: 1,
                  key: "quality",
                  name: "质量",
                  weight: 40,
                  metricHint: "指标"
                }
              ]
            }
          ],
          todos: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cycles: [],
          todos: []
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerPerformancePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("编辑维度-141")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("编辑维度-141"));
    fireEvent.change(screen.getByLabelText("编辑维度名称-141"), {
      target: { value: "质量改进" }
    });
    fireEvent.click(screen.getByLabelText("保存维度-141"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/performance/dimensions/141",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("\"version\":1")
        })
      );
    });
  });

  it("deletes a performance dimension", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cycles: [
            {
              id: 15,
              name: "2026Q2 绩效周期",
              startDate: "2026-04-01T00:00:00.000Z",
              endDate: "2026-06-30T23:59:59.000Z",
              status: "DRAFT",
              dimensions: [
                {
                  id: 151,
                  version: 1,
                  key: "delivery",
                  name: "交付",
                  weight: 60,
                  metricHint: "指标"
                }
              ]
            }
          ],
          todos: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cycles: [
            {
              id: 15,
              name: "2026Q2 绩效周期",
              startDate: "2026-04-01T00:00:00.000Z",
              endDate: "2026-06-30T23:59:59.000Z",
              status: "DRAFT",
              dimensions: []
            }
          ],
          todos: []
        })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerPerformancePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("删除维度-151")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("删除维度-151"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/performance/dimensions/151",
        expect.objectContaining({ method: "DELETE" })
      );
    });
    confirmSpy.mockRestore();
  });

  it("updates todo done state", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cycles: [],
          todos: [
            {
              id: 91,
              ownerRole: "MANAGER",
              title: "待确认事项",
              done: false
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 91, done: true })
      });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<ManagerPerformancePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("待办完成-91")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("待办完成-91"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/performance/todos/91",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });
});
