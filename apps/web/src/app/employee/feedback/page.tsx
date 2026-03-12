"use client";

import { useEffect, useState } from "react";
import { ApiClientError, apiGet, apiPatch, apiPost } from "../../../lib/api-client";
import AppShell from "../../../components/app-shell";
import PageHeader from "../../../components/page-header";
import ResultState from "../../../components/result-state";
import SessionExpiryNotice from "../../../components/session-expiry-notice";
import { useAuthGuard } from "../../../lib/use-auth-guard";

type FeedbackItem = {
  reportId: number;
  status: string;
  thisWeekText: string;
  submittedAt?: string;
  mentionLeader?: boolean;
  mentionComment?: string;
  latestDecision: string;
  latestComment: string;
  latestReviewedAt: string;
};

type TimelineItem = {
  id: number;
  decision: string;
  comment: string;
  createdAt: string;
  reviewer: { realName: string; username: string };
};

type MyReportItem = {
  id: number;
  status: string;
  thisWeekText: string;
  submittedAt?: string;
  updatedAt?: string;
};

export default function EmployeeFeedbackPage() {
  const guard = useAuthGuard({
    currentPath: "/employee/feedback",
    requiredAny: ["feedback:read"]
  });
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [myReports, setMyReports] = useState<MyReportItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "REJECTED" | "APPROVED">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [cycleIdInput, setCycleIdInput] = useState(() =>
    Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""))
  );
  const [thisWeekText, setThisWeekText] = useState("");
  const [nextWeekText, setNextWeekText] = useState("");
  const [risksText, setRisksText] = useState("");
  const [needsHelpText, setNeedsHelpText] = useState("");
  const [mentionLeader, setMentionLeader] = useState(false);
  const [mentionComment, setMentionComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resubmittingId, setResubmittingId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const formatTime = (value: string) =>
    new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

  const loadTimeline = async (reportId: number) => {
    const timelineData = await apiGet<{
      items: TimelineItem[];
    }>(`/api/weekly-reports/${reportId}/timeline`);
    setSelectedReportId(reportId);
    setTimeline(timelineData.items ?? []);
    setExpandedIds([]);
  };

  const loadFeedback = async () => {
    const [feedbackData, myReportsData] = await Promise.all([
      apiGet<{
        items: FeedbackItem[];
      }>("/api/weekly-reports/mine/feedback"),
      apiGet<{
        items: MyReportItem[];
      }>("/api/weekly-reports?page=1&pageSize=50")
    ]);
    setItems(feedbackData.items ?? []);
    setMyReports(myReportsData.items || []);
    if ((feedbackData.items ?? []).length > 0) {
      await loadTimeline(feedbackData.items[0].reportId);
    } else {
      setSelectedReportId(null);
      setTimeline([]);
    }
  };

  const pendingCount = myReports.filter((item) => item.status === "PENDING_APPROVAL").length;
  const approvedCount = myReports.filter((item) => item.status === "APPROVED").length;
  const rejectedCount = myReports.filter((item) => item.status === "REJECTED").length;

  const submitWeeklyReport = async () => {
    if (!thisWeekText.trim() || !nextWeekText.trim()) {
      setError("本周工作与下周计划不能为空。");
      return;
    }
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await apiPost("/api/weekly-reports", {
        cycleId: Number(cycleIdInput),
        thisWeekText: thisWeekText.trim(),
        nextWeekText: nextWeekText.trim(),
        risksText: risksText.trim(),
        needsHelpText: needsHelpText.trim(),
        mentionLeader,
        mentionComment: mentionComment.trim()
      });
      setNotice("周报已提交，等待直属主管审批。");
      setThisWeekText("");
      setNextWeekText("");
      setRisksText("");
      setNeedsHelpText("");
      setMentionLeader(false);
      setMentionComment("");
      await loadFeedback();
    } catch (submitError) {
      if (submitError instanceof ApiClientError && submitError.status === 401) {
        setError("登录已过期，请重新登录。");
        return;
      }
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  const resubmitReport = async (reportId: number) => {
    setError("");
    setNotice("");
    setResubmittingId(reportId);
    try {
      await apiPatch(`/api/weekly-reports/${reportId}`, { action: "resubmit" });
      setNotice(`周报 #${reportId} 已重新提交。`);
      await loadFeedback();
    } catch (submitError) {
      if (submitError instanceof ApiClientError && submitError.status === 401) {
        setError("登录已过期，请重新登录。");
        return;
      }
      setError(submitError instanceof Error ? submitError.message : "重提失败，请稍后重试。");
    } finally {
      setResubmittingId(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredItems = items
    .filter((item) => (filter === "all" ? true : item.latestDecision === filter))
    .sort((a, b) => {
      const t1 = new Date(a.latestReviewedAt).getTime();
      const t2 = new Date(b.latestReviewedAt).getTime();
      return sortOrder === "desc" ? t2 - t1 : t1 - t2;
    });
  const rejectedPendingCount = items.filter((item) => item.status === "REJECTED").length;

  useEffect(() => {
    if (!guard.ready) {
      return;
    }
    const load = async () => {
      try {
        await loadFeedback();
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 403) {
          setError("暂无查看反馈权限，请联系管理员。");
          return;
        }
        if (error instanceof ApiClientError && error.status === 401) {
          setError("登录已过期，请重新登录。");
          return;
        }
        if (error instanceof ApiClientError) {
          setError("加载反馈失败，请稍后重试。");
          return;
        }
        setError("网络异常，请检查连接后重试。");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [guard.ready]);

  if (!guard.ready || guard.blocked) {
    return null;
  }

  return (
    <AppShell
      workspace="employee-workspace"
      pageTitle="我的周报"
      pageDescription="提交周报并查看直属主管审批建议"
    >
      <div style={{ maxWidth: "980px", margin: "0 auto" }}>
        <PageHeader title="审批反馈" subtitle="聚焦本周提交状态与待改进建议。" />
        <SessionExpiryNotice />
        {loading ? <p>加载中...</p> : null}
        {error ? <ResultState type="error" message={error} /> : null}
        {notice ? <ResultState type="success" message={notice} /> : null}

      {!loading && !error ? (
        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "16px"
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px" }}>我的周报概览</h2>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
            <span>待审批：{pendingCount}</span>
            <span>已通过：{approvedCount}</span>
            <span>已驳回：{rejectedCount}</span>
            <span>总数：{myReports.length}</span>
          </div>
          {myReports.length > 0 ? (
            <ul style={{ margin: "10px 0 0", paddingLeft: "18px" }}>
              {myReports.slice(0, 5).map((item) => (
                <li key={item.id}>
                  #{item.id} {item.thisWeekText}（{item.status}）
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ marginBottom: 0 }}>暂无提交记录。</p>
          )}
        </section>
      ) : null}

      {!loading && !error ? (
        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "16px",
            display: "grid",
            gap: "8px"
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px" }}>提交周报</h2>
          <input
            aria-label="周期ID"
            type="number"
            value={cycleIdInput}
            onChange={(event) => setCycleIdInput(Number(event.target.value))}
          />
          <textarea
            aria-label="本周工作"
            placeholder="本周工作"
            value={thisWeekText}
            onChange={(event) => setThisWeekText(event.target.value)}
          />
          <textarea
            aria-label="下周计划"
            placeholder="下周计划"
            value={nextWeekText}
            onChange={(event) => setNextWeekText(event.target.value)}
          />
          <textarea
            aria-label="风险与阻塞"
            placeholder="风险与阻塞"
            value={risksText}
            onChange={(event) => setRisksText(event.target.value)}
          />
          <textarea
            aria-label="需协助事项"
            placeholder="需协助事项"
            value={needsHelpText}
            onChange={(event) => setNeedsHelpText(event.target.value)}
          />
          <label>
            <input
              aria-label="@直属领导提醒"
              type="checkbox"
              checked={mentionLeader}
              onChange={(event) => setMentionLeader(event.target.checked)}
            />{" "}
            @直属领导提醒查阅
          </label>
          <input
            aria-label="@提醒备注"
            placeholder="@提醒备注（可选）"
            value={mentionComment}
            onChange={(event) => setMentionComment(event.target.value)}
            disabled={!mentionLeader}
          />
          <button type="button" onClick={() => void submitWeeklyReport()} disabled={submitting}>
            {submitting ? "提交中..." : "提交周报"}
          </button>
        </section>
      ) : null}
      {!loading && !error && rejectedPendingCount > 0 ? (
        <section
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: "10px",
            padding: "10px 12px",
            marginBottom: "12px"
          }}
        >
          你有 {rejectedPendingCount} 条周报被驳回，待修改后重新提交。
        </section>
      ) : null}

      {!loading && !error ? (
        <section>
          <h2 style={{ fontSize: "18px" }}>最新建议</h2>
          {items.length > 0 ? (
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button type="button" onClick={() => setFilter("all")}>
                全部
              </button>
              <button type="button" onClick={() => setFilter("REJECTED")}>
                仅驳回
              </button>
              <button type="button" onClick={() => setFilter("APPROVED")}>
                仅通过
              </button>
              <button
                type="button"
                onClick={() =>
                  setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
                }
              >
                {sortOrder === "desc" ? "最新优先" : "最早优先"}
              </button>
            </div>
          ) : null}
          {items.length === 0 ? <p>暂无审批建议。</p> : null}
          {filteredItems.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "12px" }}>
              {filteredItems.map((item) => (
                <li
                  key={item.reportId}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "14px"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void loadTimeline(item.reportId)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      textAlign: "left",
                      width: "100%",
                      cursor: "pointer",
                      color:
                        selectedReportId === item.reportId
                          ? "var(--primary-strong)"
                          : "var(--text)"
                    }}
                  >
                    <div>
                      <strong>周报 #{item.reportId}</strong> · {item.latestDecision}
                    </div>
                    <div style={{ marginTop: "6px" }}>{item.latestComment}</div>
                    {item.mentionLeader ? (
                      <div style={{ marginTop: "4px", color: "var(--primary-strong)", fontSize: "12px" }}>
                        已@直属领导：{item.mentionComment?.trim() || "请查阅"}
                      </div>
                    ) : null}
                    <div style={{ marginTop: "4px", color: "var(--muted)", fontSize: "12px" }}>
                      {formatTime(item.latestReviewedAt)}
                    </div>
                    {item.submittedAt ? (
                      <div style={{ marginTop: "2px", color: "var(--muted)", fontSize: "12px" }}>
                        提交于：{formatTime(item.submittedAt)}
                      </div>
                    ) : null}
                  </button>
                  {item.status === "REJECTED" ? (
                    <div style={{ marginTop: "8px" }}>
                      <button
                        type="button"
                        onClick={() => void resubmitReport(item.reportId)}
                        disabled={resubmittingId === item.reportId}
                      >
                        {resubmittingId === item.reportId ? "重提中..." : "重新提交"}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {items.length > 0 && filteredItems.length === 0 ? (
            <p>当前筛选下暂无反馈。</p>
          ) : null}
        </section>
      ) : null}

      {!loading && !error && timeline.length > 0 ? (
        <section style={{ marginTop: "20px" }}>
          <h2 style={{ fontSize: "18px" }}>审批时间线</h2>
          <ol style={{ paddingLeft: "18px" }}>
            {timeline.map((entry) => (
              <li key={entry.id} style={{ marginBottom: "8px" }}>
                <span
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#e2e8f0",
                    fontSize: "11px",
                    marginRight: "6px"
                  }}
                >
                  {(entry.reviewer.realName || entry.reviewer.username).slice(0, 1)}
                </span>
                {entry.decision} -{" "}
                {expandedIds.includes(entry.id) || entry.comment.length <= 24
                  ? entry.comment
                  : `${entry.comment.slice(0, 24)}...`}
                {entry.comment.length > 24 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(entry.id)}
                    style={{ marginLeft: "6px" }}
                  >
                    {expandedIds.includes(entry.id) ? "收起" : "展开"}
                  </button>
                ) : null}
                （{entry.reviewer.realName}，{formatTime(entry.createdAt)}）
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      </div>
    </AppShell>
  );
}
