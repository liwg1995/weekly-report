"use client";

import { useEffect } from "react";
import { navigateTo } from "../../../lib/navigation";

export default function EmployeeWorkspacePage() {
  useEffect(() => {
    navigateTo("/employee/feedback");
  }, []);

  return null;
}
