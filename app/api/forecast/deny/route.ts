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

export async function GET(request: NextRequest) {
  return handleForecastDenial(request);
}

export async function POST(request: NextRequest) {
  return handleForecastDenial(request);
}

async function handleForecastDenial(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    console.log(`Deny forecast request received. Query params:`, queryParams);

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
        { error: "Phone number not provided" },
        { status: 400 }
      );
    }

    console.log(`Denial from phone: ${phoneNumber}`);

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
        { error: "No collaborator found for this phone number" },
        { status: 404 }
      );
    }

    const locationId = matchingCollaborator.location_id;

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

    // Use today's date
    const forecastDate = new Date().toISOString().split("T")[0];

    // Record the denial
    const { error: responseError } = await supabase
      .from("forecast_responses")
      .insert({
        location_id: locationId,
        organization_id: location.organization_id,
        forecast_date: forecastDate,
        response_type: "deny",
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

    console.log(
      `Recorded denial for location ${locationId} from ${phoneNumber}`
    );

    return NextResponse.json({
      status: "recorded",
      message: "Thanks for your response. You won't receive the forecast.",
      location_id: locationId,
      location_name: location.name,
      forecast_date: forecastDate,
      response_type: "deny",
    });
  } catch (error) {
    console.error(`Error processing forecast denial:`, error);
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
