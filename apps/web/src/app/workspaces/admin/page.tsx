"use client";

import { useEffect } from "react";
import { navigateTo } from "../../../lib/navigation";

export default function AdminWorkspacePage() {
  useEffect(() => {
    navigateTo("/manager/org");
  }, []);

  return null;
}
