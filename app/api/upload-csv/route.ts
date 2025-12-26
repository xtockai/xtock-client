import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface CSVData {
  date: string;
  item: string;
  quantity: number;
}

interface RequestBody {
  locationId: string;
  organizationId: string;
  csvData: CSVData[];
}

export async function POST(request: NextRequest) {
  try {
    const { locationId, organizationId, csvData }: RequestBody =
      await request.json();

    if (!locationId || !organizationId || !csvData || !Array.isArray(csvData)) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: locationId, organizationId, or csvData",
        },
        { status: 400 }
      );
    }

    if (csvData.length === 0) {
      return NextResponse.json({ error: "CSV data is empty" }, { status: 400 });
    }

    // Get existing sales data for this location to check for duplicates
    const { data: existingSalesData, error: fetchError } = await supabase
      .from("sales_data")
      .select("timestamp, item")
      .eq("location_id", locationId);

    if (fetchError) {
      console.error("Error fetching existing sales data:", fetchError);
      return NextResponse.json(
        { error: "Failed to check existing data" },
        { status: 500 }
      );
    }

    // Create a set of existing records for fast lookup
    // Format: "YYYY-MM-DD|item_name"
    const existingRecords = new Set<string>();
    if (existingSalesData) {
      existingSalesData.forEach((record) => {
        const date = new Date(record.timestamp).toISOString().split("T")[0];
        const key = `${date}|${record.item.trim().toLowerCase()}`;
        existingRecords.add(key);
      });
    }

    // Process CSV data and filter out duplicates
    const newRecords: any[] = [];
    let duplicateCount = 0;

    for (const csvRow of csvData) {
      try {
        // Parse and validate date
        const parsedDate = parseDate(csvRow.date);
        const dateString = parsedDate.toISOString().split("T")[0]; // YYYY-MM-DD format

        // Create lookup key
        const lookupKey = `${dateString}|${csvRow.item.trim().toLowerCase()}`;

        // Check if this record already exists
        if (existingRecords.has(lookupKey)) {
          duplicateCount++;
          continue; // Skip this record
        }

        // Add to new records
        newRecords.push({
          location_id: locationId,
          organization_id: organizationId,
          timestamp: parsedDate.toISOString(),
          item: csvRow.item.trim(),
          quantity: csvRow.quantity,
          revenue_cents: null,
          provider: "manual",
          source: "csv_upload",
        });
      } catch (error) {
        console.error("Error processing CSV row:", error, csvRow);
        // Skip invalid rows
        continue;
      }
    }

    // Insert new records if any
    let insertedCount = 0;
    if (newRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("sales_data")
        .insert(newRecords);

      if (insertError) {
        console.error("Error inserting new sales data:", insertError);
        return NextResponse.json(
          { error: "Failed to save new records" },
          { status: 500 }
        );
      }

      insertedCount = newRecords.length;
    }

    return NextResponse.json({
      success: true,
      newRecords: insertedCount,
      duplicates: duplicateCount,
      totalProcessed: csvData.length,
    });
  } catch (error) {
    console.error("Error in CSV upload API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to parse various date formats
function parseDate(dateStr: string): Date {
  // Remove any extra whitespace
  dateStr = dateStr.trim();

  // Handle various date formats
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // ISO format: YYYY-MM-DD
    return new Date(dateStr + "T00:00:00.000Z");
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    // Format: DD/MM/YYYY or MM/DD/YYYY
    const [first, second, year] = dateStr.split("/").map(Number);

    // Logic to determine if it's DD/MM/YYYY (European/Spanish) or MM/DD/YYYY (US)
    // If first part is > 12, it must be day (DD/MM/YYYY)
    // If second part is > 12, it must be DD/MM/YYYY format
    let day: number, month: number;

    if (first > 12) {
      // Definitely DD/MM/YYYY format
      day = first;
      month = second;
    } else if (second > 12) {
      // Definitely DD/MM/YYYY format
      day = first;
      month = second;
    } else {
      // Ambiguous case (both <= 12)
      // Default to DD/MM/YYYY (European/Spanish format) since it's more common internationally
      // and the user mentioned Spanish format specifically
      day = first;
      month = second;
    }

    // Validate month
    if (month < 1 || month > 12) {
      throw new Error(`Invalid month in date: ${dateStr}`);
    }

    // Validate day (basic check)
    if (day < 1 || day > 31) {
      throw new Error(`Invalid day in date: ${dateStr}`);
    }

    return new Date(year, month - 1, day);
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    // European format: DD-MM-YYYY
    const [day, month, year] = dateStr.split("-").map(Number);

    // Validate month
    if (month < 1 || month > 12) {
      throw new Error(`Invalid month in date: ${dateStr}`);
    }

    // Validate day (basic check)
    if (day < 1 || day > 31) {
      throw new Error(`Invalid day in date: ${dateStr}`);
    }

    return new Date(year, month - 1, day);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    // Format with single digits: D/M/YYYY or DD/M/YYYY or D/MM/YYYY
    const [first, second, year] = dateStr.split("/").map(Number);

    // Apply same logic as above for DD/MM/YYYY vs MM/DD/YYYY
    let day: number, month: number;

    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      day = first;
      month = second;
    } else {
      // Default to DD/MM/YYYY format
      day = first;
      month = second;
    }

    // Validate
    if (month < 1 || month > 12) {
      throw new Error(`Invalid month in date: ${dateStr}`);
    }
    if (day < 1 || day > 31) {
      throw new Error(`Invalid day in date: ${dateStr}`);
    }

    return new Date(year, month - 1, day);
  }

  if (/^\d{8}$/.test(dateStr)) {
    // Compact format: YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  // Try parsing as-is for other formats
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid date format: ${dateStr}. Supported formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, YYYYMMDD`
    );
  }
  return date;
}
