import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export default function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <label className="ui-form-field">
      <span className="ui-form-label">{label}</span>
      {children}
      {hint ? <span className="ui-form-hint">{hint}</span> : null}
    </label>
  );
}
