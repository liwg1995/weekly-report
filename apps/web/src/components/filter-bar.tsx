import type { ReactNode } from "react";

export default function FilterBar({ children }: { children: ReactNode }) {
  return <section className="ui-filter-bar">{children}</section>;
}
