export function navigateTo(path: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.location.assign(path);
}
