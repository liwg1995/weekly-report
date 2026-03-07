#!/usr/bin/env node

const baseUrl = process.env.BENCH_BASE_URL || "http://127.0.0.1:3000";
const username = process.env.BENCH_USERNAME || "admin";
const password = process.env.BENCH_PASSWORD || "123456";
const totalRequests = toPositiveInt(process.env.BENCH_REQUESTS, 120);
const concurrency = toPositiveInt(process.env.BENCH_CONCURRENCY, 12);

function toPositiveInt(raw, fallback) {
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

async function login() {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const duration = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`login failed: http ${response.status}`);
  }
  const body = await response.json();
  if (!body?.accessToken) {
    throw new Error("login failed: missing accessToken");
  }
  return { token: body.accessToken, duration };
}

async function benchmarkEndpoint(name, path, token) {
  let finished = 0;
  let inflight = 0;
  let cursor = 0;
  let okCount = 0;
  const latencies = [];
  const errors = [];

  return await new Promise((resolve) => {
    const maybeRunNext = () => {
      while (inflight < concurrency && cursor < totalRequests) {
        cursor += 1;
        inflight += 1;
        const startedAt = performance.now();
        fetch(`${baseUrl}${path}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
          .then(async (response) => {
            const duration = performance.now() - startedAt;
            latencies.push(duration);
            if (response.ok) {
              okCount += 1;
            } else {
              const text = await response.text().catch(() => "");
              errors.push(`http ${response.status} ${text}`.trim());
            }
          })
          .catch((error) => {
            const duration = performance.now() - startedAt;
            latencies.push(duration);
            errors.push(error instanceof Error ? error.message : String(error));
          })
          .finally(() => {
            finished += 1;
            inflight -= 1;
            if (finished >= totalRequests) {
              const sorted = [...latencies].sort((a, b) => a - b);
              const avg =
                latencies.reduce((acc, item) => acc + item, 0) /
                (latencies.length || 1);
              resolve({
                name,
                path,
                totalRequests,
                okCount,
                failCount: totalRequests - okCount,
                avg,
                p50: percentile(sorted, 50),
                p95: percentile(sorted, 95),
                max: sorted[sorted.length - 1] ?? 0,
                errors: errors.slice(0, 3)
              });
              return;
            }
            maybeRunNext();
          });
      }
    };
    maybeRunNext();
  });
}

async function main() {
  console.log("== Local API Benchmark ==");
  console.log(`baseUrl=${baseUrl}`);
  console.log(`requests=${totalRequests}, concurrency=${concurrency}`);
  const loginResult = await login();
  console.log(`login: ok (${formatMs(loginResult.duration)})`);

  const targets = [
    { name: "PendingReports", path: "/weekly-reports?status=PENDING_APPROVAL" },
    { name: "ReviewLogs", path: "/audit-logs/reviews?limit=10" },
    { name: "NotifyChannels", path: "/notifications/channels" }
  ];

  for (const target of targets) {
    const result = await benchmarkEndpoint(target.name, target.path, loginResult.token);
    const successRate = ((result.okCount / result.totalRequests) * 100).toFixed(2);
    console.log(`\n[${result.name}] ${result.path}`);
    console.log(
      `ok=${result.okCount}/${result.totalRequests} (${successRate}%), fail=${result.failCount}`
    );
    console.log(
      `avg=${formatMs(result.avg)}, p50=${formatMs(result.p50)}, p95=${formatMs(
        result.p95
      )}, max=${formatMs(result.max)}`
    );
    if (result.errors.length > 0) {
      console.log("sample errors:");
      result.errors.forEach((item) => console.log(`- ${item}`));
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[benchmark] failed: ${message}`);
  process.exit(1);
});

