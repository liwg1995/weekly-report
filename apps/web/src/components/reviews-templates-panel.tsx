type ExportColumn = "time" | "actor" | "action" | "targetId";

type ExportTemplate = {
  id: string;
  name: string;
  createdAt: string;
  pinned: boolean;
  diffExportMaskSensitive?: boolean;
  filters: {
    decision?: "all" | "APPROVED" | "REJECTED";
    actorKeyword?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  columns: Record<ExportColumn, boolean>;
  encoding: "utf-8" | "gbk";
};

type TemplateVersion = {
  id: number;
  templateId: string;
  createdAt: string;
  name: string;
  pinned: boolean;
  filters: ExportTemplate["filters"];
  columns: ExportTemplate["columns"];
  encoding: "utf-8" | "gbk";
};

type TemplateDiffDetail = {
  label: string;
  current: string;
  history: string;
};

type Props = {
  isSuperAdmin: boolean;
  maskSensitiveInDiffExport: boolean;
  onMaskSensitiveChange: (checked: boolean) => void;
  templateOwnerUserId: string;
  onTemplateOwnerUserIdChange: (value: string) => void;
  onSwitchTemplateOwner: () => void;
  templateName: string;
  onTemplateNameChange: (value: string) => void;
  templateQuery: string;
  onTemplateQueryChange: (value: string) => void;
  onSaveCurrentAsTemplate: () => void;
  onExportTemplatesAsJson: () => void;
  onImportTemplatesFromJson: () => void;
  templateJsonText: string;
  onTemplateJsonTextChange: (value: string) => void;
  showPendingImportConflict: boolean;
  pendingDuplicateCount: number;
  onImportOverwrite: () => void;
  onImportSkip: () => void;
  templateSwitching: boolean;
  templateSwitchedOwner: string;
  filteredTemplates: ExportTemplate[];
  templateVersionLoadingId: string;
  templateRenameMap: Record<string, string>;
  templateVersions: Record<string, TemplateVersion[]>;
  templateVersionDiffOpenMap: Record<string, boolean>;
  templateDiffValueExpandMap: Record<string, boolean>;
  onToggleTemplateDiffMaskDefault: (id: string) => void;
  onTogglePinTemplate: (id: string) => void;
  onApplyTemplateExport: (template: ExportTemplate) => void;
  onLoadTemplateVersions: (id: string) => void;
  onTemplateRenameInputChange: (id: string, value: string) => void;
  onRenameTemplate: (id: string, fallbackName: string) => void;
  onRemoveTemplate: (id: string) => void;
  formatHistoryTime: (value: string) => string;
  buildTemplateDiffSummary: (template: ExportTemplate, version: TemplateVersion) => string;
  onCopyTemplateDiffDetails: (template: ExportTemplate, version: TemplateVersion) => void;
  onExportTemplateDiffDetailsTxt: (template: ExportTemplate, version: TemplateVersion) => void;
  onToggleTemplateVersionDiff: (templateId: string, versionId: number) => void;
  onRollbackTemplate: (templateId: string, versionId: number) => void;
  buildTemplateDiffDetails: (template: ExportTemplate, version: TemplateVersion) => TemplateDiffDetail[];
  onToggleTemplateDiffValueExpand: (key: string) => void;
};

const DIFF_VALUE_PREVIEW_MAX = 48;

export default function ReviewsTemplatesPanel(props: Props) {
  return (
    <section id="templates" style={{ marginTop: "16px", padding: "12px" }}>
      <h2 style={{ marginTop: 0, fontSize: "16px" }}>导出模板</h2>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <label>
          <input
            type="checkbox"
            aria-label="导出差异TXT脱敏"
            checked={props.maskSensitiveInDiffExport}
            onChange={(event) => props.onMaskSensitiveChange(event.target.checked)}
          />
          导出差异TXT脱敏
        </label>
        {props.isSuperAdmin ? (
          <>
            <input
              aria-label="模板用户ID"
              placeholder="用户ID（超级管理员）"
              value={props.templateOwnerUserId}
              onChange={(event) => props.onTemplateOwnerUserIdChange(event.target.value)}
            />
            <button type="button" onClick={props.onSwitchTemplateOwner}>
              切换用户模板
            </button>
          </>
        ) : null}
        <input
          aria-label="模板名称"
          placeholder="输入模板名称"
          value={props.templateName}
          onChange={(event) => props.onTemplateNameChange(event.target.value)}
        />
        <input
          aria-label="模板搜索"
          placeholder="搜索模板"
          value={props.templateQuery}
          onChange={(event) => props.onTemplateQueryChange(event.target.value)}
        />
        <button type="button" onClick={props.onSaveCurrentAsTemplate}>
          收藏当前配置为模板
        </button>
        <button type="button" onClick={props.onExportTemplatesAsJson}>
          导出模板JSON
        </button>
        <button type="button" onClick={props.onImportTemplatesFromJson}>
          导入模板JSON
        </button>
      </div>
      <textarea
        aria-label="模板JSON内容"
        placeholder="粘贴模板 JSON 数组"
        value={props.templateJsonText}
        onChange={(event) => props.onTemplateJsonTextChange(event.target.value)}
        rows={4}
        style={{
          width: "100%",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "8px",
          marginBottom: "8px"
        }}
      />
      <p style={{ marginTop: 0, marginBottom: "8px", color: "var(--muted)" }}>
        模板JSON字段说明：diffExportMaskSensitive=true（脱敏）、false（原文）
      </p>
      {props.showPendingImportConflict ? (
        <div style={{ marginBottom: "8px" }}>
          <p style={{ marginTop: 0 }}>检测到 {props.pendingDuplicateCount} 个同名模板</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={props.onImportOverwrite}>
              覆盖同名并导入
            </button>
            <button type="button" onClick={props.onImportSkip}>
              跳过同名并导入
            </button>
          </div>
        </div>
      ) : null}
      {props.templateSwitching ? (
        <p style={{ marginTop: 0, marginBottom: "8px" }}>正在切换模板用户...</p>
      ) : null}
      {!props.templateSwitching &&
      props.isSuperAdmin &&
      props.templateSwitchedOwner &&
      props.filteredTemplates.length === 0 ? (
        <p style={{ marginTop: 0, marginBottom: "8px" }}>该用户暂无模板</p>
      ) : null}
      {props.filteredTemplates.length === 0 ? <p style={{ margin: 0 }}>暂无模板</p> : null}
      {props.filteredTemplates.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: "18px" }}>
          {props.filteredTemplates.map((template) => (
            <li key={template.id} data-testid="export-template-item">
              <strong>{template.name}</strong>{" "}
              {template.pinned ? <span style={{ color: "var(--primary-strong)" }}>[已置顶]</span> : null}{" "}
              <span style={{ color: "var(--muted)" }}>
                差异TXT默认：
                {typeof template.diffExportMaskSensitive === "boolean"
                  ? template.diffExportMaskSensitive
                    ? "脱敏"
                    : "原文"
                  : props.maskSensitiveInDiffExport
                    ? "脱敏（跟随全局）"
                    : "原文（跟随全局）"}
              </span>{" "}
              <button
                type="button"
                aria-label={`切换模板脱敏默认-${template.name}`}
                onClick={() => props.onToggleTemplateDiffMaskDefault(template.id)}
              >
                {(() => {
                  const current =
                    typeof template.diffExportMaskSensitive === "boolean"
                      ? template.diffExportMaskSensitive
                      : props.maskSensitiveInDiffExport;
                  return current ? "设为原文" : "设为脱敏";
                })()}
              </button>{" "}
              <button
                type="button"
                aria-label={`置顶模板-${template.name}`}
                onClick={() => props.onTogglePinTemplate(template.id)}
              >
                {template.pinned ? "取消置顶" : "置顶"}
              </button>{" "}
              <button
                type="button"
                aria-label={`应用模板并导出-${template.name}`}
                onClick={() => props.onApplyTemplateExport(template)}
              >
                应用模板并导出
              </button>{" "}
              <button
                type="button"
                aria-label={`查看模板版本-${template.name}`}
                onClick={() => props.onLoadTemplateVersions(template.id)}
              >
                {props.templateVersionLoadingId === template.id ? "加载中..." : "历史版本"}
              </button>{" "}
              <input
                aria-label={`模板新名称-${template.name}`}
                placeholder="新名称"
                value={props.templateRenameMap[template.id] ?? ""}
                onChange={(event) => props.onTemplateRenameInputChange(template.id, event.target.value)}
              />{" "}
              <button
                type="button"
                aria-label={`重命名模板-${template.name}`}
                onClick={() => props.onRenameTemplate(template.id, template.name)}
              >
                重命名
              </button>{" "}
              <button
                type="button"
                aria-label={`删除模板-${template.name}`}
                onClick={() => props.onRemoveTemplate(template.id)}
              >
                删除模板
              </button>
              {props.templateVersions[template.id]?.length ? (
                <ul style={{ marginTop: "6px", marginBottom: 0 }}>
                  {props.templateVersions[template.id].map((version) => (
                    <li key={version.id}>
                      版本#{version.id}（{props.formatHistoryTime(version.createdAt)}）{" "}
                      <span style={{ color: "var(--muted)" }}>
                        与当前差异：{props.buildTemplateDiffSummary(template, version)}
                      </span>{" "}
                      <button
                        type="button"
                        aria-label={`复制差异详情-${template.name}-${version.id}`}
                        onClick={() => props.onCopyTemplateDiffDetails(template, version)}
                      >
                        复制差异
                      </button>{" "}
                      <button
                        type="button"
                        aria-label={`导出差异详情TXT-${template.name}-${version.id}`}
                        onClick={() => props.onExportTemplateDiffDetailsTxt(template, version)}
                      >
                        导出差异TXT
                      </button>{" "}
                      <button
                        type="button"
                        aria-label={`查看差异详情-${template.name}-${version.id}`}
                        onClick={() => props.onToggleTemplateVersionDiff(template.id, version.id)}
                      >
                        {props.templateVersionDiffOpenMap[`${template.id}-${version.id}`]
                          ? "收起差异详情"
                          : "查看差异详情"}
                      </button>{" "}
                      <button
                        type="button"
                        aria-label={`回滚模板版本-${template.name}-${version.id}`}
                        onClick={() => props.onRollbackTemplate(template.id, version.id)}
                      >
                        回滚到该版本
                      </button>
                      {props.templateVersionDiffOpenMap[`${template.id}-${version.id}`] ? (
                        <ul style={{ marginTop: "4px", marginBottom: 0 }}>
                          {props.buildTemplateDiffDetails(template, version).map((detail) => (
                            <li
                              key={detail.label}
                              data-testid={`template-diff-row-${template.id}-${version.id}-${detail.label}`}
                              style={{
                                background: "rgba(25, 118, 210, 0.08)",
                                border: "1px solid rgba(25, 118, 210, 0.28)",
                                borderRadius: "8px",
                                padding: "6px"
                              }}
                            >
                              <div>字段：{detail.label}</div>
                              <div>
                                当前：
                                {(() => {
                                  const expandKey = `${template.id}-${version.id}-${detail.label}-current`;
                                  const expanded = Boolean(props.templateDiffValueExpandMap[expandKey]);
                                  const needsCollapse = detail.current.length > DIFF_VALUE_PREVIEW_MAX;
                                  const displayed =
                                    needsCollapse && !expanded
                                      ? `${detail.current.slice(0, DIFF_VALUE_PREVIEW_MAX)}...`
                                      : detail.current;
                                  return (
                                    <>
                                      {displayed}
                                      {needsCollapse ? (
                                        <>
                                          {" "}
                                          <button
                                            type="button"
                                            aria-label={`${
                                              expanded ? "收起" : "展开"
                                            }差异值-${template.name}-${version.id}-${detail.label}-current`}
                                            onClick={() => props.onToggleTemplateDiffValueExpand(expandKey)}
                                          >
                                            {expanded ? "收起" : "展开"}
                                          </button>
                                        </>
                                      ) : null}
                                    </>
                                  );
                                })()}
                              </div>
                              <div>
                                历史：
                                {(() => {
                                  const expandKey = `${template.id}-${version.id}-${detail.label}-history`;
                                  const expanded = Boolean(props.templateDiffValueExpandMap[expandKey]);
                                  const needsCollapse = detail.history.length > DIFF_VALUE_PREVIEW_MAX;
                                  const displayed =
                                    needsCollapse && !expanded
                                      ? `${detail.history.slice(0, DIFF_VALUE_PREVIEW_MAX)}...`
                                      : detail.history;
                                  return (
                                    <>
                                      {displayed}
                                      {needsCollapse ? (
                                        <>
                                          {" "}
                                          <button
                                            type="button"
                                            aria-label={`${
                                              expanded ? "收起" : "展开"
                                            }差异值-${template.name}-${version.id}-${detail.label}-history`}
                                            onClick={() => props.onToggleTemplateDiffValueExpand(expandKey)}
                                          >
                                            {expanded ? "收起" : "展开"}
                                          </button>
                                        </>
                                      ) : null}
                                    </>
                                  );
                                })()}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
