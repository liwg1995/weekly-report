"use client";

import { useEffect } from "react";
import { navigateTo } from "../../../lib/navigation";

export default function ReviewWorkspacePage() {
  useEffect(() => {
    navigateTo("/manager/reviews");
  }, []);

  return null;
}
