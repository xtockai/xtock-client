import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function normalizePhoneNumber(phoneNumber: string | undefined): string | null {
  if (!phoneNumber) return null;

  // Remove whatsapp: prefix if present
  let cleaned = phoneNumber.replace("whatsapp:", "").trim();

  // Remove any spaces, dashes, or parentheses
  cleaned = cleaned.replace(/[\s\-\(\)]/g, "");

  // Add + if missing
  if (!cleaned.startsWith("+")) {
    cleaned = `+${cleaned}`;
  }

  return cleaned;
}

// Helper function to get all possible phone number variations
function getPhoneVariations(phone: string): string[] {
  const variations = [phone];

  // Remove + and add it back
  const withoutPlus = phone.replace("+", "");
  variations.push(withoutPlus);
  variations.push(`+${withoutPlus}`);

  // For Mexican numbers, handle the "1" that might be added/removed
  if (phone.startsWith("+52") || phone.startsWith("52")) {
    const baseNumber = withoutPlus.replace(/^52/, "");
    variations.push(`+521${baseNumber}`); // With 1
    variations.push(`521${baseNumber}`);  // Without +, with 1
    variations.push(`+52${baseNumber}`);  // Without 1
    variations.push(`52${baseNumber}`);   // Without + and 1
  }

  return [...new Set(variations)]; // Remove duplicates
}

export async function GET(request: NextRequest) {
  return handleDemoDenial(request);
}

export async function POST(request: NextRequest) {
  return handleDemoDenial(request);
}

async function handleDemoDenial(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    console.log(`Demo deny request received. Query params:`, queryParams);

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

    console.log(`Looking up demo request for phone: ${phoneNumber}`);

    // Get all possible variations of the phone number
    const phoneVariations = getPhoneVariations(phoneNumber);
    console.log(`Trying phone variations:`, phoneVariations);

    // Find pending demo request for this phone number (try all variations)
    const { data: demoRequests, error: requestError } = await supabase
      .from("demo_whatsapp_request")
      .select("*")
      .in("phone", phoneVariations)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (requestError) {
      console.error("Error fetching demo request:", requestError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!demoRequests || demoRequests.length === 0) {
      console.error(
        `No pending demo request found for phone variations:`,
        phoneVariations
      );
      return NextResponse.json(
        {
          error:
            "No pending demo request found for this phone number.",
        },
        { status: 404 }
      );
    }

    const demoRequest = demoRequests[0];

    console.log(
      `Denying demo request for restaurant: ${demoRequest.restaurant}`
    );

    // Update the request status to 'denied'
    const { error: updateError } = await supabase
      .from("demo_whatsapp_request")
      .update({ status: "denied", updated_at: new Date().toISOString() })
      .eq("id", demoRequest.id);

    if (updateError) {
      console.error("Error updating demo request status:", updateError);
      return NextResponse.json(
        { error: "Error updating request status" },
        { status: 500 }
      );
    }

    console.log(
      `Demo request denied for ${demoRequest.restaurant} from ${phoneNumber}`
    );

    return NextResponse.json({
      status: "recorded",
      message: "Thanks for your response. You won't receive the forecast.",
      restaurant: demoRequest.restaurant,
      phone_number: phoneNumber,
      response_type: "deny",
    });
  } catch (error) {
    console.error(`Error processing demo denial:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
