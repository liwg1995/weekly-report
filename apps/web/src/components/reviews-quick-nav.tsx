export default function ReviewsQuickNav() {
  return (
    <nav className="reviews-quick-nav" aria-label="审批快捷导航">
      <a href="#pending-list">待审列表</a>
      <a href="#templates">导出模板</a>
      <a href="#logs">操作日志</a>
      <a href="#exports">导出任务</a>
      <a href="/manager/performance">绩效占位</a>
    </nav>
  );
}
