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
  try {
    // Use Intl.DateTimeFormat for more reliable timezone offset calculation
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });

    // Get the timezone name and extract offset
    const parts = formatter.formatToParts(date);
    const tzNamePart = parts.find((part) => part.type === "timeZoneName");

    if (tzNamePart) {
      // Try to extract offset from timezone name (e.g., "EST", "EDT", "GMT+5")
      const tzName = tzNamePart.value;
      const offsetMatch = tzName.match(/GMT([+-]\d+)/);
      if (offsetMatch) {
        return parseInt(offsetMatch[1]) * 60;
      }
    }

    // Fallback: calculate offset by comparing UTC time with local time
    const utcTime = date.getTime();
    const localTime = date.toLocaleString("en-US", { timeZone: timezone });
    const localDate = new Date(localTime);
    const offset = (localDate.getTime() - utcTime) / 60000;

    return Math.round(offset);
  } catch (error) {
    console.warn(`Failed to get timezone offset for ${timezone}, using 0`);
    return 0;
  }
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

/**
 * Convert local time to TIMETZ format for database storage
 * @param time - Time in HH:MM format in user's local timezone
 * @param timezone - IANA timezone string
 * @returns Time in TIMETZ format (HH:MM:SS+TZ)
 */
export function convertLocalTimeToTIMETZ(
  time: string,
  timezone: string
): string {
  const [hours, minutes] = time.split(":").map(Number);

  // Create a date in the specified timezone (using today's date)
  const date = new Date();

  // Get the timezone offset for the specified timezone
  const tzOffset = getTimezoneOffset(timezone, date);

  // Format the time part
  const timeString = `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:00`;

  // Calculate offset in hours and minutes
  const offsetHours = Math.floor(Math.abs(tzOffset) / 60);
  const offsetMinutes = Math.abs(tzOffset) % 60;
  const offsetSign = tzOffset >= 0 ? "+" : "-";

  // Format offset as +HH:MM or -HH:MM
  const offsetString = `${offsetSign}${String(offsetHours).padStart(
    2,
    "0"
  )}:${String(offsetMinutes).padStart(2, "0")}`;

  return `${timeString}${offsetString}`;
}

/**
 * Convert TIMETZ from database to local time format
 * @param timetz - Time in TIMETZ format (HH:MM:SS+TZ)
 * @param targetTimezone - Target timezone for display
 * @returns Time in HH:MM format in target timezone
 */
export function convertTIMETZToLocalTime(
  timetz: string,
  targetTimezone: string
): string {
  if (!timetz) return "";

  try {
    // Check if it's TIMETZ format (has + or -)
    if (timetz.includes("+") || timetz.includes("-")) {
      // Parse TIMETZ (e.g., "15:30:00-05")
      const [timePart, tzPart] = timetz.split(/[+-]/);
      const sign = timetz.includes("+") ? 1 : -1;
      const [hours, minutes, seconds] = timePart.split(":").map(Number);
      const tzOffset =
        sign *
        (parseInt(tzPart.substring(0, 2)) * 60 +
          parseInt(tzPart.substring(2, 4)));

      // Create UTC date
      const utcDate = new Date();
      utcDate.setUTCHours(hours, minutes, seconds || 0, 0);

      // Adjust for the stored timezone offset to get actual UTC
      utcDate.setTime(utcDate.getTime() - tzOffset * 60000);

      // Convert to target timezone
      const targetOffset = getTimezoneOffset(targetTimezone, utcDate);
      const localDate = new Date(utcDate.getTime() + targetOffset * 60000);

      // Format as HH:MM
      const localHours = String(localDate.getUTCHours()).padStart(2, "0");
      const localMinutes = String(localDate.getUTCMinutes()).padStart(2, "0");

      return `${localHours}:${localMinutes}`;
    } else {
      // Handle TIME format (existing data) - assume it's in UTC
      const [hours, minutes] = timetz.split(":").map(Number);

      // Create a UTC date
      const utcDate = new Date();
      utcDate.setUTCHours(hours, minutes, 0, 0);

      // Convert to target timezone
      const targetOffset = getTimezoneOffset(targetTimezone, utcDate);
      const localDate = new Date(utcDate.getTime() + targetOffset * 60000);

      // Format as HH:MM
      const localHours = String(localDate.getUTCHours()).padStart(2, "0");
      const localMinutes = String(localDate.getUTCMinutes()).padStart(2, "0");

      return `${localHours}:${localMinutes}`;
    }
  } catch (error) {
    console.warn("Error converting time:", error, "Input:", timetz);
    return timetz.substring(0, 5); // Return first 5 chars as fallback (HH:MM)
  }
}

/**
 * Extract timezone from TIMETZ field and find corresponding timezone string
 * @param timetz - Time in TIMETZ format (HH:MM:SS+TZ)
 * @returns IANA timezone string or default timezone
 */
export function extractTimezoneFromTIMETZ(timetz: string): string {
  if (!timetz) return "America/New_York"; // Default timezone

  console.log("Extracting timezone from TIMETZ:", timetz);

  try {
    // Check if it's TIMETZ format (has + or -)
    if (timetz.includes("+") || timetz.includes("-")) {
      // Parse offset (e.g., "15:30:00-05:00" -> "-05" or "15:30:00-05" -> "-05")
      const offsetMatch = timetz.match(/([+-]\d{2}):?(\d{2})?/);
      if (offsetMatch) {
        const offsetHours = parseInt(offsetMatch[1]);
        const offsetMinutes = offsetMatch[2] ? parseInt(offsetMatch[2]) : 0;
        const totalOffsetMinutes =
          offsetHours * 60 + (offsetHours < 0 ? -offsetMinutes : offsetMinutes);

        console.log(
          "Extracted offset hours:",
          offsetHours,
          "minutes:",
          offsetMinutes,
          "total minutes:",
          totalOffsetMinutes
        );

        // Map common offsets to timezones
        // Note: This covers both standard and daylight saving time offsets
        const timezoneMap: { [key: string]: string } = {
          "-600": "Pacific/Honolulu", // Hawaii (UTC-10)
          "-540": "America/Anchorage", // Alaska (UTC-9)
          "-480": "America/Los_Angeles", // Pacific (UTC-8) / Tijuana
          "-420": "America/Denver", // Mountain (UTC-7)
          "-360": "America/Chicago", // Central (UTC-6) / Mexico City / Monterrey
          "-300": "America/New_York", // Eastern (UTC-5) / Bogotá / Lima / Cancún
          "-240": "America/Santiago", // Chile (UTC-4) / Atlantic
          "-180": "America/Buenos_Aires", // Argentina (UTC-3) / São Paulo
          "-120": "America/Sao_Paulo", // Brazil summer time (UTC-2)
          "0": "Europe/London", // GMT (UTC+0)
          "60": "Europe/Paris", // CET (UTC+1) / Madrid / Rome / Berlin
          "120": "Europe/Paris", // CEST summer time (UTC+2)
          "240": "Asia/Dubai", // UAE (UTC+4)
          "330": "Asia/Kolkata", // India (UTC+5:30)
          "480": "Asia/Shanghai", // China/Singapore/Hong Kong (UTC+8)
          "540": "Asia/Tokyo", // Japan (UTC+9)
          "600": "Australia/Sydney", // Australian Eastern (UTC+10)
          "660": "Australia/Sydney", // Australian Eastern DST (UTC+11)
        };

        const detectedTimezone = timezoneMap[totalOffsetMinutes.toString()];
        console.log("Detected timezone:", detectedTimezone);

        return detectedTimezone || "America/New_York";
      }
    }

    // Default fallback
    console.log("Using default timezone fallback");
    return "America/New_York";
  } catch (error) {
    console.warn("Error extracting timezone from TIMETZ:", error);
    return "America/New_York";
  }
}
