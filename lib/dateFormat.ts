export function formatEventDate(rawDate?: string) {
  if (!rawDate) return "";

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  }

  const fallback = Date.parse(rawDate);
  if (!Number.isNaN(fallback)) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(fallback));
  }

  return rawDate;
}
