type ConfirmDialogOptions = {
  title: string;
  detail?: string;
};

export const confirmDialog = ({ title, detail }: ConfirmDialogOptions): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.confirm(detail ? `${title}\n${detail}` : title);
};
