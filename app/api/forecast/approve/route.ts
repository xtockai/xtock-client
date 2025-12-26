import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface CollaboratorRow {
  id: string;
  location_id: string;
  contact_type: "phone" | "email";
  contact_value: string;
}

interface LocationRow {
  id: string;
  name: string;
  organization_id: string;
}

interface ForecastRow {
  id: string;
  location_id: string;
  forecast_date: string;
  product_name: string;
  quantity: number;
  unit: string;
}

export async function GET(request: NextRequest) {
  return handleForecastApproval(request);
}

export async function POST(request: NextRequest) {
  return handleForecastApproval(request);
}

async function handleForecastApproval(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    console.log(
      `Approve forecast request received. Query params:`,
      queryParams
    );

    // Extract phone number from WhatsApp common parameter names
    const phoneNumber = normalizePhoneNumber(
      queryParams.WaId ||
        queryParams.From ||
        queryParams.phone ||
        queryParams.number
    );

    if (!phoneNumber) {
      console.error("No phone number found in request");
      return NextResponse.json(
        { error: "Phone number not provided. Please contact support." },
        { status: 400 }
      );
    }

    console.log(`Looking up collaborator with phone: ${phoneNumber}`);

    // Find collaborator by phone number
    const { data: collaborators, error: collabError } = await supabase
      .from("collaborators")
      .select("id, location_id, contact_type, contact_value")
      .eq("contact_type", "phone");

    if (collabError) {
      console.error("Error fetching collaborators:", collabError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const matchingCollaborator = collaborators?.find(
      (collab: CollaboratorRow) => {
        const storedNumber = normalizePhoneNumber(collab.contact_value);
        return storedNumber === phoneNumber;
      }
    );

    if (!matchingCollaborator) {
      console.error(`No collaborator found with phone number: ${phoneNumber}`);
      return NextResponse.json(
        {
          error:
            "No collaborator found for this phone number. Please contact support.",
        },
        { status: 404 }
      );
    }

    const locationId = matchingCollaborator.location_id;
    console.log(`Found collaborator for location: ${locationId}`);

    // Use today's date as forecast date
    const forecastDate = new Date().toISOString().split("T")[0];

    // Get forecasts for this location and date
    const { data: forecasts, error: forecastError } = await supabase
      .from("forecasts")
      .select("*")
      .eq("location_id", locationId)
      .eq("forecast_date", forecastDate);

    if (forecastError) {
      console.error("Error fetching forecasts:", forecastError);
      return NextResponse.json(
        { error: "Error fetching forecasts" },
        { status: 500 }
      );
    }

    if (!forecasts || forecasts.length === 0) {
      console.warn(
        `No forecasts found for location ${locationId} on ${forecastDate}`
      );
      return NextResponse.json(
        { error: "No forecast available for today. Please check back later." },
        { status: 404 }
      );
    }

    // Get location info
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id, name, organization_id")
      .eq("id", locationId)
      .single();

    if (locationError || !location) {
      console.error(`Location ${locationId} not found:`, locationError);
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // TODO: Implement WhatsApp forecast sending logic here
    // This would typically involve calling a WhatsApp API or service
    console.log(
      `Would send WhatsApp forecast to ${phoneNumber} for location ${location.name}`
    );

    // Record the acceptance
    const { error: responseError } = await supabase
      .from("forecast_responses")
      .insert({
        location_id: locationId,
        organization_id: location.organization_id,
        forecast_date: forecastDate,
        response_type: "accept",
        phone_number: phoneNumber,
        collaborator_id: matchingCollaborator.id,
      });

    if (responseError) {
      console.error("Error recording response:", responseError);
      return NextResponse.json(
        { error: "Error recording response" },
        { status: 500 }
      );
    }

    console.log(`Forecast sent successfully to ${phoneNumber}`);

    return NextResponse.json({
      status: "success",
      message: "Forecast sent successfully!",
      location_id: locationId,
      location_name: location.name,
      forecast_date: forecastDate,
      forecasts_count: forecasts.length,
      phone_number: phoneNumber,
    });
  } catch (error) {
    console.error(`Error processing forecast approval:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function normalizePhoneNumber(phoneNumber: string | undefined): string | null {
  if (!phoneNumber) return null;

  // Remove whatsapp: prefix if present
  let cleaned = phoneNumber.replace("whatsapp:", "");

  // Add + if missing
  if (!cleaned.startsWith("+")) {
    cleaned = `+${cleaned}`;
  }

  return cleaned;
}
