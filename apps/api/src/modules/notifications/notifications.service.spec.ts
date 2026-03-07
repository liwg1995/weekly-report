import { NotificationsService } from "./notifications.service";
import { createHmac } from "crypto";

describe("NotificationsService", () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NOTIFY_WECOM_ENABLED;
    delete process.env.NOTIFY_WECOM_WEBHOOK_URL;
    delete process.env.NOTIFY_DINGTALK_ENABLED;
    delete process.env.NOTIFY_DINGTALK_WEBHOOK_URL;
    delete process.env.NOTIFY_REVIEW_TEMPLATE;
    delete process.env.NOTIFY_RETRY_MAX_ATTEMPTS;
    delete process.env.NOTIFY_RETRY_BASE_DELAY_MS;
    delete process.env.NOTIFY_HTTP_TIMEOUT_MS;
    delete process.env.NOTIFY_DINGTALK_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns channel switches from env", () => {
    process.env.NOTIFY_WECOM_ENABLED = "true";
    process.env.NOTIFY_WECOM_WEBHOOK_URL = "https://wecom.example/webhook";
    process.env.NOTIFY_DINGTALK_ENABLED = "false";
    process.env.NOTIFY_DINGTALK_WEBHOOK_URL = "";

    const service = new NotificationsService();
    const channels = service.getChannels();

    expect(channels).toEqual({
      wecom: {
        enabled: true,
        webhookConfigured: true
      },
      dingtalk: {
        enabled: false,
        webhookConfigured: false
      }
    });
  });

  it("sends webhook payload for enabled and configured channels", async () => {
    process.env.NOTIFY_WECOM_ENABLED = "true";
    process.env.NOTIFY_WECOM_WEBHOOK_URL = "https://wecom.example/webhook";
    process.env.NOTIFY_DINGTALK_ENABLED = "true";
    process.env.NOTIFY_DINGTALK_WEBHOOK_URL = "https://dingtalk.example/webhook";

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errcode: 0 })
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new NotificationsService();
    await service.sendReviewDecisionNotification({
      reportId: 101,
      reviewerUserId: 1,
      employeeUserId: 2,
      decision: "APPROVED",
      comment: "继续保持"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://wecom.example/webhook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://dingtalk.example/webhook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
    const firstBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    ) as { text: { content: string } };
    expect(firstBody.text.content).toContain("周报ID：101");
    expect(firstBody.text.content).toContain("审批结果：通过");
  });

  it("renders custom message template from env", async () => {
    process.env.NOTIFY_WECOM_ENABLED = "true";
    process.env.NOTIFY_WECOM_WEBHOOK_URL = "https://wecom.example/webhook";
    process.env.NOTIFY_REVIEW_TEMPLATE =
      "[{decision}] report={reportId};reviewer={reviewerUserId};unknown={missing}";

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errcode: 0 })
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new NotificationsService();
    await service.sendReviewDecisionNotification({
      reportId: 201,
      reviewerUserId: 11,
      employeeUserId: 22,
      decision: "REJECTED",
      comment: "请补充"
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    ) as { text: { content: string } };
    expect(body.text.content).toContain("[驳回]");
    expect(body.text.content).toContain("report=201");
    expect(body.text.content).toContain("reviewer=11");
    expect(body.text.content).toContain("unknown={missing}");
  });

  it("retries on transient webhook failure and then succeeds", async () => {
    process.env.NOTIFY_DINGTALK_ENABLED = "true";
    process.env.NOTIFY_DINGTALK_WEBHOOK_URL = "https://dingtalk.example/webhook";
    process.env.NOTIFY_RETRY_MAX_ATTEMPTS = "3";
    process.env.NOTIFY_RETRY_BASE_DELAY_MS = "1";

    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errcode: 0 })
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new NotificationsService();
    await service.sendReviewDecisionNotification({
      reportId: 301,
      reviewerUserId: 1,
      employeeUserId: 2,
      decision: "APPROVED",
      comment: ""
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("skips sending when channel is enabled but webhook not configured", async () => {
    process.env.NOTIFY_WECOM_ENABLED = "true";
    process.env.NOTIFY_WECOM_WEBHOOK_URL = "";

    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new NotificationsService();
    await service.sendReviewDecisionNotification({
      reportId: 102,
      reviewerUserId: 1,
      employeeUserId: 2,
      decision: "REJECTED",
      comment: "请补充风险说明"
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not throw when webhook request fails", async () => {
    process.env.NOTIFY_DINGTALK_ENABLED = "true";
    process.env.NOTIFY_DINGTALK_WEBHOOK_URL = "https://dingtalk.example/webhook";

    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const service = new NotificationsService();
    await expect(
      service.sendReviewDecisionNotification({
        reportId: 103,
        reviewerUserId: 1,
        employeeUserId: 2,
        decision: "APPROVED",
        comment: ""
      })
    ).resolves.toBeUndefined();
  });

  it("does not throw when webhook returns non-zero errcode", async () => {
    process.env.NOTIFY_WECOM_ENABLED = "true";
    process.env.NOTIFY_WECOM_WEBHOOK_URL = "https://wecom.example/webhook";

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errcode: 40001 })
    }) as unknown as typeof fetch;

    const service = new NotificationsService();
    await expect(
      service.sendReviewDecisionNotification({
        reportId: 104,
        reviewerUserId: 1,
        employeeUserId: 2,
        decision: "REJECTED",
        comment: "不符合要求"
      })
    ).resolves.toBeUndefined();
  });

  it("appends dingtalk sign parameters when secret is configured", async () => {
    process.env.NOTIFY_DINGTALK_ENABLED = "true";
    process.env.NOTIFY_DINGTALK_WEBHOOK_URL = "https://dingtalk.example/webhook?access_token=abc";
    process.env.NOTIFY_DINGTALK_SECRET = "ding-secret";
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errcode: 0 })
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new NotificationsService();
    await service.sendReviewDecisionNotification({
      reportId: 401,
      reviewerUserId: 7,
      employeeUserId: 8,
      decision: "APPROVED",
      comment: "ok"
    });

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    const expectedSign = createHmac("sha256", "ding-secret")
      .update("1700000000000\nding-secret")
      .digest("base64");
    expect(calledUrl).toContain("access_token=abc");
    expect(calledUrl).toContain("timestamp=1700000000000");
    expect(calledUrl).toContain(`sign=${encodeURIComponent(expectedSign)}`);
    nowSpy.mockRestore();
  });

  it("treats abort-like error as timeout and still resolves", async () => {
    process.env.NOTIFY_DINGTALK_ENABLED = "true";
    process.env.NOTIFY_DINGTALK_WEBHOOK_URL = "https://dingtalk.example/webhook";
    process.env.NOTIFY_RETRY_MAX_ATTEMPTS = "1";
    process.env.NOTIFY_HTTP_TIMEOUT_MS = "10";

    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    globalThis.fetch = jest.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

    const service = new NotificationsService();
    await expect(
      service.sendReviewDecisionNotification({
        reportId: 402,
        reviewerUserId: 7,
        employeeUserId: 8,
        decision: "REJECTED",
        comment: "no"
      })
    ).resolves.toBeUndefined();
  });
});
