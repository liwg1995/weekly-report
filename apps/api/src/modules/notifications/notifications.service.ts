import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "crypto";

type NotificationChannel = "wecom" | "dingtalk";

type ReviewDecision = "APPROVED" | "REJECTED";

type ReviewDecisionNotificationPayload = {
  reportId: number;
  reviewerUserId: number;
  employeeUserId: number;
  decision: ReviewDecision;
  comment: string;
};

type NotificationChannelConfig = {
  enabled: boolean;
  webhookConfigured: boolean;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private readBoolEnv(key: string): boolean {
    return process.env[key]?.toLowerCase() === "true";
  }

  private readIntEnv(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : Number.NaN;
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }

  private getChannelConfig(channel: NotificationChannel): NotificationChannelConfig {
    if (channel === "wecom") {
      return {
        enabled: this.readBoolEnv("NOTIFY_WECOM_ENABLED"),
        webhookConfigured: Boolean(process.env.NOTIFY_WECOM_WEBHOOK_URL?.trim())
      };
    }
    return {
      enabled: this.readBoolEnv("NOTIFY_DINGTALK_ENABLED"),
      webhookConfigured: Boolean(process.env.NOTIFY_DINGTALK_WEBHOOK_URL?.trim())
    };
  }

  getChannels() {
    return {
      wecom: this.getChannelConfig("wecom"),
      dingtalk: this.getChannelConfig("dingtalk")
    };
  }

  async sendReviewDecisionNotification(payload: ReviewDecisionNotificationPayload) {
    const content = this.buildReviewDecisionMessage(payload);
    const channels = this.getChannels();
    const enabledEntries = (Object.entries(channels) as Array<
      [NotificationChannel, NotificationChannelConfig]
    >).filter(([, config]) => config.enabled);

    for (const [channel, config] of enabledEntries) {
      const webhookUrl =
        channel === "wecom"
          ? process.env.NOTIFY_WECOM_WEBHOOK_URL?.trim()
          : process.env.NOTIFY_DINGTALK_WEBHOOK_URL?.trim();
      if (!config.webhookConfigured) {
        this.logger.warn(
          `skip ${channel} notification because webhook is not configured`
        );
        continue;
      }
      try {
        await this.postWebhookWithRetry(channel, webhookUrl as string, {
          msgtype: "text",
          text: {
            content
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        this.logger.error(`send ${channel} notification failed: ${message}`);
      }
    }
  }

  private buildReviewDecisionMessage(payload: ReviewDecisionNotificationPayload) {
    const decisionText = payload.decision === "APPROVED" ? "通过" : "驳回";
    const defaultTemplate = [
      "【周报审批通知】",
      "周报ID：{reportId}",
      "审批结果：{decision}",
      "审批人ID：{reviewerUserId}",
      "员工ID：{employeeUserId}",
      "审批建议：{comment}"
    ].join("\n");
    const template = process.env.NOTIFY_REVIEW_TEMPLATE?.trim() || defaultTemplate;
    return this.renderTemplate(template, {
      reportId: String(payload.reportId),
      decision: decisionText,
      reviewerUserId: String(payload.reviewerUserId),
      employeeUserId: String(payload.employeeUserId),
      comment: payload.comment || "(无)"
    });
  }

  private renderTemplate(template: string, vars: Record<string, string>) {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (matched, key: string) => {
      if (key in vars) {
        return vars[key];
      }
      return matched;
    });
  }

  private async postWebhookWithRetry(
    channel: NotificationChannel,
    webhookUrl: string,
    body: Record<string, unknown>
  ) {
    const maxAttempts = this.readIntEnv("NOTIFY_RETRY_MAX_ATTEMPTS", 3);
    const baseDelayMs = this.readIntEnv("NOTIFY_RETRY_BASE_DELAY_MS", 200);
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.postWebhook(channel, webhookUrl, body);
        return;
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts) {
          throw error;
        }
        const delay = baseDelayMs * 2 ** (attempt - 1);
        await this.sleep(delay);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("unknown notify error");
  }

  private async sleep(ms: number) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async postWebhook(
    channel: NotificationChannel,
    webhookUrl: string,
    body: Record<string, unknown>
  ) {
    const timeoutMs = this.readIntEnv("NOTIFY_HTTP_TIMEOUT_MS", 3000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(this.resolveWebhookUrl(channel, webhookUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      const abortLike =
        error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message));
      if (abortLike) {
        throw new Error(`timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      throw new Error(`http ${response.status}`);
    }
    let responseJson: unknown = null;
    try {
      responseJson = await response.json();
    } catch {
      responseJson = null;
    }
    if (
      responseJson &&
      typeof responseJson === "object" &&
      "errcode" in responseJson &&
      typeof (responseJson as { errcode: unknown }).errcode === "number" &&
      (responseJson as { errcode: number }).errcode !== 0
    ) {
      throw new Error(
        `${channel} errcode ${(responseJson as { errcode: number }).errcode}`
      );
    }
  }

  private resolveWebhookUrl(channel: NotificationChannel, webhookUrl: string): string {
    if (channel !== "dingtalk") {
      return webhookUrl;
    }
    const secret = process.env.NOTIFY_DINGTALK_SECRET?.trim();
    if (!secret) {
      return webhookUrl;
    }
    const timestamp = Date.now();
    const sign = createHmac("sha256", secret)
      .update(`${timestamp}\n${secret}`)
      .digest("base64");
    const parsed = new URL(webhookUrl);
    parsed.searchParams.set("timestamp", String(timestamp));
    parsed.searchParams.set("sign", sign);
    return parsed.toString();
  }
}
