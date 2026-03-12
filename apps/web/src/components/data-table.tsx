import type { ReactNode } from "react";

type DataTableProps = {
  columns: string[];
  rows: Array<ReactNode[]>;
  emptyText?: string;
};

export default function DataTable({ columns, rows, emptyText = "暂无数据" }: DataTableProps) {
  if (rows.length === 0) {
    return <div className="ui-data-table-empty">{emptyText}</div>;
  }

  return (
    <div className="ui-data-table-wrap">
      <table className="ui-data-table">
        <thead>
          <tr>
            {columns.map((item) => (
              <th key={item}>{item}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
