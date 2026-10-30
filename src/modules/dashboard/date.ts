import { isCalendarDate } from "@/modules/wedding/validation";

export function daysUntilWedding(date: string, now = new Date()) {
  if (!isCalendarDate(date)) throw new Error("Invalid wedding date.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  return Math.round(
    (Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) /
      86400000,
  );
}
export function countdownLabel(days: number) {
  return days === 0
    ? "Today is your wedding day"
    : days > 0
      ? `${days} ${days === 1 ? "day" : "days"} to go`
      : `Your wedding was ${Math.abs(days)} ${days === -1 ? "day" : "days"} ago`;
}
export function weddingDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "long",
  }).format(new Date(date + "T00:00:00+05:30"));
}
