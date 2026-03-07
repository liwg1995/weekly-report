"use client";

import { useEffect, useState } from "react";
import { ApiClientError, apiGet } from "../../../lib/api-client";
import { logoutWithConfirm, requireRole } from "../../../lib/auth-session";
import SessionExpiryNotice from "../../../components/session-expiry-notice";

type FeedbackItem = {
  reportId: number;
  status: string;
  thisWeekText: string;
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

export default function EmployeeFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "REJECTED" | "APPROVED">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
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
    setTimeline(timelineData.items);
    setExpandedIds([]);
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
    const load = async () => {
      const allowed = requireRole(["EMPLOYEE"], "/manager/reviews");
      if (!allowed) {
        setLoading(false);
        return;
      }
      try {
        const feedbackData = await apiGet<{
          items: FeedbackItem[];
        }>("/api/weekly-reports/mine/feedback");
        setItems(feedbackData.items);

        if (feedbackData.items.length > 0) {
          await loadTimeline(feedbackData.items[0].reportId);
        }
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
  }, []);

  return (
    <main style={{ maxWidth: "980px", margin: "0 auto", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginTop: 0 }}>审批反馈</h1>
        <button type="button" onClick={logoutWithConfirm}>
          退出登录
        </button>
      </div>
      <SessionExpiryNotice />
      {loading ? <p>加载中...</p> : null}
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
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
                    <div style={{ marginTop: "4px", color: "var(--muted)", fontSize: "12px" }}>
                      {formatTime(item.latestReviewedAt)}
                    </div>
                  </button>
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
    </main>
  );
}
