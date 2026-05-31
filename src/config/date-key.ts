export function formatDateKey(date: Date, timeZone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = readPart(parts, "year");
  const month = readPart(parts, "month");
  const day = readPart(parts, "day");

  return `${year}-${month}-${day}`;
}

export function dateFromDateKey(dateKey: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return new Date(`${dateKey}T00:00:00.000Z`);
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((entry) => entry.type === type)?.value;

  if (!part) {
    throw new Error(`Unable to format date part: ${type}`);
  }

  return part;
}
