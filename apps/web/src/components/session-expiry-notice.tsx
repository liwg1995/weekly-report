"use client";

import { useEffect, useState } from "react";
import { getAccessToken, getTokenRemainingSeconds } from "../lib/auth-session";

const WARNING_SECONDS = 30 * 60;

export default function SessionExpiryNotice() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const token = getAccessToken();
      const seconds = getTokenRemainingSeconds(token);
      setRemaining(seconds);
    };

    update();
    const timer = window.setInterval(update, 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (remaining === null || remaining > WARNING_SECONDS || remaining <= 0) {
    return null;
  }

  const minutes = Math.max(1, Math.ceil(remaining / 60));
  return (
    <p
      style={{
        marginTop: 0,
        marginBottom: "10px",
        color: "#92400e",
        background: "#fffbeb",
        border: "1px solid #fcd34d",
        borderRadius: "8px",
        padding: "8px 10px"
      }}
    >
      登录将在 {minutes} 分钟后过期，请及时保存内容。
    </p>
  );
}
