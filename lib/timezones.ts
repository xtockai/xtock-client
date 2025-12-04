export const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)", offset: "UTC-5/-4" },
  { value: "America/Chicago", label: "Central Time (CT)", offset: "UTC-6/-5" },
  { value: "America/Denver", label: "Mountain Time (MT)", offset: "UTC-7/-6" },
  {
    value: "America/Los_Angeles",
    label: "Pacific Time (PT)",
    offset: "UTC-8/-7",
  },
  {
    value: "America/Anchorage",
    label: "Alaska Time (AKT)",
    offset: "UTC-9/-8",
  },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)", offset: "UTC-10" },
  { value: "America/Mexico_City", label: "Mexico City", offset: "UTC-6/-5" },
  { value: "America/Cancun", label: "Cancún", offset: "UTC-5" },
  { value: "America/Monterrey", label: "Monterrey", offset: "UTC-6/-5" },
  { value: "America/Tijuana", label: "Tijuana", offset: "UTC-8/-7" },
  { value: "America/Bogota", label: "Bogotá", offset: "UTC-5" },
  { value: "America/Lima", label: "Lima", offset: "UTC-5" },
  { value: "America/Santiago", label: "Santiago", offset: "UTC-4/-3" },
  { value: "America/Buenos_Aires", label: "Buenos Aires", offset: "UTC-3" },
  { value: "America/Sao_Paulo", label: "São Paulo", offset: "UTC-3/-2" },
  { value: "Europe/London", label: "London", offset: "UTC+0/+1" },
  { value: "Europe/Paris", label: "Paris", offset: "UTC+1/+2" },
  { value: "Europe/Madrid", label: "Madrid", offset: "UTC+1/+2" },
  { value: "Europe/Rome", label: "Rome", offset: "UTC+1/+2" },
  { value: "Europe/Berlin", label: "Berlin", offset: "UTC+1/+2" },
  { value: "Asia/Tokyo", label: "Tokyo", offset: "UTC+9" },
  { value: "Asia/Shanghai", label: "Shanghai", offset: "UTC+8" },
  { value: "Asia/Hong_Kong", label: "Hong Kong", offset: "UTC+8" },
  { value: "Asia/Singapore", label: "Singapore", offset: "UTC+8" },
  { value: "Asia/Dubai", label: "Dubai", offset: "UTC+4" },
  { value: "Asia/Kolkata", label: "India", offset: "UTC+5:30" },
  { value: "Australia/Sydney", label: "Sydney", offset: "UTC+10/+11" },
];

/**
 * Convert local time to UTC for database storage
 * @param time - Time in HH:MM format (24-hour) in user's local timezone
 * @param timezone - IANA timezone string of the user
 * @returns Time in UTC as HH:MM:SS format
 */
export function convertLocalTimeToUTC(time: string, timezone: string): string {
  const [hours, minutes] = time.split(":").map(Number);

  // Create a date in the user's timezone (using today's date)
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Create date string in user's timezone
  const localDateString = `${year}-${String(month + 1).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:00`;

  // Parse as if it's in the user's timezone
  const userDate = new Date(localDateString);

  // Get the timezone offset in minutes
  const userTimezoneOffset = getTimezoneOffset(timezone, userDate);

  // Convert to UTC by adding the offset
  const utcDate = new Date(userDate.getTime() - userTimezoneOffset * 60000);

  // Format as HH:MM:SS
  const utcHours = String(utcDate.getUTCHours()).padStart(2, "0");
  const utcMinutes = String(utcDate.getUTCMinutes()).padStart(2, "0");
  const utcSeconds = String(utcDate.getUTCSeconds()).padStart(2, "0");

  return `${utcHours}:${utcMinutes}:${utcSeconds}`;
}

/**
 * Convert UTC time from database to user's local timezone
 * @param utcTime - Time in UTC as HH:MM:SS or HH:MM format
 * @param timezone - IANA timezone string of the user
 * @returns Time in user's local timezone as HH:MM format
 */
export function convertUTCToLocalTime(
  utcTime: string,
  timezone: string
): string {
  if (!utcTime) return "";

  const [hours, minutes] = utcTime.split(":").map(Number);

  // Create a UTC date (using today's date)
  const utcDate = new Date();
  utcDate.setUTCHours(hours, minutes, 0, 0);

  // Get the timezone offset in minutes
  const userTimezoneOffset = getTimezoneOffset(timezone, utcDate);

  // Convert to user's timezone by adding the offset
  const localDate = new Date(utcDate.getTime() + userTimezoneOffset * 60000);

  // Format as HH:MM
  const localHours = String(localDate.getUTCHours()).padStart(2, "0");
  const localMinutes = String(localDate.getUTCMinutes()).padStart(2, "0");

  return `${localHours}:${localMinutes}`;
}

/**
 * Get timezone offset in minutes for a given timezone
 * @param timezone - IANA timezone string
 * @param date - Reference date (for DST handling)
 * @returns Offset in minutes from UTC
 */
function getTimezoneOffset(timezone: string, date: Date): number {
  // Format the date in the target timezone
  const tzString = date.toLocaleString("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Parse the formatted string
  const [datePart, timePart] = tzString.split(", ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  // Create a date object from the timezone components
  const tzDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Calculate offset
  const offset = (tzDate.getTime() - date.getTime()) / 60000;

  return offset;
}

/**
 * Get user's current timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Find timezone object by value
 */
export function getTimezoneByValue(value: string) {
  return TIMEZONES.find((tz) => tz.value === value) || TIMEZONES[0];
}
