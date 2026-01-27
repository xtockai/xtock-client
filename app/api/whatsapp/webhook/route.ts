import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractTimezoneFromTIMETZ } from "@/lib/timezones";
import twilio from "twilio";

// Simple forecasting function
function predictTomorrowSales(
  historicalData: { date: string; item: string; quantity: number }[],
): { [item: string]: number } {
  const itemData: { [item: string]: number[] } = {};

  historicalData.forEach((record) => {
    if (!itemData[record.item]) {
      itemData[record.item] = [];
    }
    itemData[record.item].push(record.quantity);
  });

  const predictions: { [item: string]: number } = {};

  Object.keys(itemData).forEach((item) => {
    const quantities = itemData[item];
    const last7 = quantities.slice(-7);
    const avg =
      last7.length > 0 ? last7.reduce((a, b) => a + b, 0) / last7.length : 0;
    predictions[item] = Math.round(avg);
  });

  return predictions;
}

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
    const afterCountryCode = withoutPlus.replace(/^52/, ""); // Everything after "52"

    // Check if number has "1" after country code (mobile format)
    if (afterCountryCode.startsWith("1") && afterCountryCode.length === 11) {
      // Has "1" - generate version WITHOUT "1"
      const withoutOne = afterCountryCode.substring(1); // Remove the "1"
      variations.push(`+52${withoutOne}`);
      variations.push(`52${withoutOne}`);
    } else if (afterCountryCode.length === 10) {
      // Doesn't have "1" - generate version WITH "1"
      variations.push(`+521${afterCountryCode}`);
      variations.push(`521${afterCountryCode}`);
    }
  }

  return [...new Set(variations)]; // Remove duplicates
}

// Detect if message is an approval response
function isApprovalMessage(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const approvalKeywords = [
    "yes",
    "si",
    "sí",
    "approve",
    "aprobar",
    "ok",
    "okay",
    "accept",
    "aceptar",
  ];
  return approvalKeywords.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );
}

// Detect if message is a denial response
function isDenialMessage(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const denialKeywords = [
    "no",
    "deny",
    "denegar",
    "cancel",
    "cancelar",
    "reject",
    "rechazar",
  ];
  return denialKeywords.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );
}

async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhoneNumber) {
    console.log(`Twilio not configured. Would send: ${message}`);
    return;
  }

  const client = twilio(accountSid, authToken);
  const maxLength = 1600;

  if (message.length <= maxLength) {
    await client.messages.create({
      body: message,
      from: `whatsapp:${twilioPhoneNumber}`,
      to: `whatsapp:${phoneNumber}`,
    });
  } else {
    // Split into parts
    const parts = [];
    let remainingMessage = message;
    let partNumber = 1;
    const totalParts = Math.ceil(message.length / maxLength);

    while (remainingMessage.length > 0) {
      const chunkSize = Math.min(maxLength - 50, remainingMessage.length);
      const chunk = remainingMessage.substring(0, chunkSize);
      const partMessage = `Part ${partNumber}/${totalParts}:\n${chunk}`;
      parts.push(partMessage);
      remainingMessage = remainingMessage.substring(chunkSize);
      partNumber++;
    }

    for (const part of parts) {
      await client.messages.create({
        body: part,
        from: `whatsapp:${twilioPhoneNumber}`,
        to: `whatsapp:${phoneNumber}`,
      });
    }
  }
}

async function handleApproval(phoneNumber: string, demoRequest: any) {
  const restaurant = demoRequest.restaurant;

  console.log(`Processing approval for restaurant: ${restaurant}`);

  // Query sales_demo for this restaurant
  const { data: salesData, error: salesError } = await supabase
    .from("sales_demo")
    .select("date, item, quantity")
    .eq("restaurant", restaurant)
    .order("date", { ascending: true });

  if (salesError || !salesData || salesData.length === 0) {
    console.error("Error fetching sales demo data:", salesError);
    await sendWhatsAppMessage(
      phoneNumber,
      "Sorry, there was an error generating your forecast. Please try again later.",
    );
    return;
  }

  // Generate forecast
  const forecast = predictTomorrowSales(salesData);

  // Format forecast message
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let message = `📊 *${restaurant} Sales Forecast for ${dateStr}*\n\n`;

  // Sort products by quantity (highest to lowest)
  const sortedForecast = Object.entries(forecast).sort((a, b) => b[1] - a[1]);

  sortedForecast.forEach(([item, qty]) => {
    message += `• ${item}: ${qty} units\n`;
  });

  message += `\n*Based on historical sales analysis*`;

  // Send forecast
  await sendWhatsAppMessage(phoneNumber, message);

  // Update the request status to 'finished'
  await supabase
    .from("demo_whatsapp_request")
    .update({ status: "finished", updated_at: new Date().toISOString() })
    .eq("id", demoRequest.id);

  console.log(`Forecast sent successfully to ${phoneNumber}`);
}

async function handleDenial(phoneNumber: string, demoRequest: any) {
  console.log(`Processing denial for restaurant: ${demoRequest.restaurant}`);

  // Update the request status to 'denied'
  await supabase
    .from("demo_whatsapp_request")
    .update({ status: "denied", updated_at: new Date().toISOString() })
    .eq("id", demoRequest.id);

  // Send confirmation message
  await sendWhatsAppMessage(
    phoneNumber,
    "Thanks for your response. You won't receive the forecast. If you change your mind, feel free to request a new demo!",
  );

  console.log(
    `Demo request denied for ${demoRequest.restaurant} from ${phoneNumber}`,
  );
}

// Handle real forecast approval
async function handleForecastApproval(
  phoneNumber: string,
  phoneVariations: string[],
) {
  console.log(`Processing forecast approval for phone: ${phoneNumber}`);

  // Find collaborator by phone number variations
  const { data: collaborators, error: collabError } = await supabase
    .from("collaborators")
    .select("id, location_id, contact_type, contact_value")
    .eq("contact_type", "phone")
    .in("contact_value", phoneVariations);

  if (collabError) {
    console.error("Error fetching collaborators:", collabError);
    await sendWhatsAppMessage(
      phoneNumber,
      "Sorry, there was an error processing your request. Please try again later.",
    );
    return;
  }

  if (!collaborators || collaborators.length === 0) {
    console.error(
      `No collaborator found with phone variations:`,
      phoneVariations,
    );
    await sendWhatsAppMessage(
      phoneNumber,
      "Sorry, we couldn't find your information. Please contact support.",
    );
    return;
  }

  console.log(`Found ${collaborators.length} collaborator(s) for this phone`);

  let sentCount = 0;

  // Iterate through all collaborators
  for (const collaborator of collaborators) {
    const locationId = collaborator.location_id;
    console.log(
      `Processing location: ${locationId} for collaborator: ${collaborator.id}`,
    );

    // Get location info
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id, name, organization_id, kitchen_close")
      .eq("id", locationId)
      .single();

    if (locationError || !location) {
      console.error(`Location ${locationId} not found:`, locationError);
      continue; // Skip this collaborator and continue with next
    }

    // Extract timezone from location's kitchen_close field
    const locationTimezone = extractTimezoneFromTIMETZ(location.kitchen_close);

    // Use tomorrow's date in the location's timezone
    const now = new Date();
    const tomorrow = new Date(
      now.toLocaleString("en-US", { timeZone: locationTimezone }),
    );
    tomorrow.setDate(tomorrow.getDate() + 1);
    const forecastDate = tomorrow.toISOString().split("T")[0];
    console.log(
      "forecastDate (local timezone):",
      forecastDate,
      "timezone:",
      locationTimezone,
    );

    const dateStr = tomorrow.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    console.log(`Found location: ${location.name}`);

    // Get forecasts for this location and date
    const { data: forecasts, error: forecastError } = await supabase
      .from("forecasts")
      .select("*")
      .eq("location_id", locationId)
      .eq("forecast_date", forecastDate);

    if (forecastError) {
      console.error(
        `Error fetching forecasts for location ${locationId}:`,
        forecastError,
      );
      continue; // Skip this location and continue with next
    }

    if (!forecasts || forecasts.length === 0) {
      console.warn(
        `No forecasts found for location ${locationId} on ${forecastDate}`,
      );
      continue; // Skip this location and continue with next
    }

    // Format forecast message with tomorrow's date
    let message = `📊 *${location.name} Forecast for ${dateStr}*\n\n`;

    // Sort products by quantity (highest to lowest)
    const sortedForecasts = forecasts.sort(
      (a: any, b: any) => b.predicted_quantity - a.predicted_quantity,
    );

    sortedForecasts.forEach((forecast: any) => {
      if (
        forecast.predicted_quantity === null ||
        forecast.predicted_quantity === 0
      )
        return; // Skip null predictions
      message += `• ${forecast.item}: ${forecast.predicted_quantity} units\n`;
    });

    message += `\n*AI-powered forecast based on historical data*`;

    // Send forecast
    await sendWhatsAppMessage(phoneNumber, message);
    sentCount++;

    // Record the acceptance
    const { error: responseError } = await supabase
      .from("forecast_responses")
      .insert({
        location_id: locationId,
        organization_id: location.organization_id,
        forecast_date: forecastDate,
        response_type: "accept",
        phone_number: phoneNumber,
        collaborator_id: collaborator.id,
      });

    if (responseError) {
      console.error("Error recording response:", responseError);
    }

    console.log(
      `Forecast sent successfully to ${phoneNumber} for ${location.name}`,
    );
  }

  if (sentCount === 0) {
    await sendWhatsAppMessage(
      phoneNumber,
      "No forecast available for tomorrow. Please check back later.",
    );
  } else {
    console.log(`Total forecasts sent: ${sentCount}`);
  }
}

// Handle real forecast denial
async function handleForecastDenial(
  phoneNumber: string,
  phoneVariations: string[],
) {
  console.log(`Processing forecast denial for phone: ${phoneNumber}`);

  // Find collaborator by phone number variations
  const { data: collaborators, error: collabError } = await supabase
    .from("collaborators")
    .select("id, location_id, contact_type, contact_value")
    .eq("contact_type", "phone")
    .in("contact_value", phoneVariations);

  if (collabError) {
    console.error("Error fetching collaborators:", collabError);
    await sendWhatsAppMessage(
      phoneNumber,
      "Sorry, there was an error processing your response.",
    );
    return;
  }

  if (!collaborators || collaborators.length === 0) {
    console.error(
      `No collaborator found with phone variations:`,
      phoneVariations,
    );
    await sendWhatsAppMessage(phoneNumber, "Thanks for your response.");
    return;
  }

  const matchingCollaborator = collaborators[0];
  const locationId = matchingCollaborator.location_id;

  // Get location info
  const { data: location, error: locationError } = await supabase
    .from("locations")
    .select("id, name, organization_id, kitchen_close")
    .eq("id", locationId)
    .single();

  if (locationError || !location) {
    console.error(`Location ${locationId} not found:`, locationError);
    await sendWhatsAppMessage(phoneNumber, "Thanks for your response.");
    return;
  }

  // Extract timezone from location's kitchen_close field and use tomorrow's date in the location's timezone
  const locationTimezone = extractTimezoneFromTIMETZ(location.kitchen_close);
  const now = new Date();
  const tomorrow = new Date(
    now.toLocaleString("en-US", { timeZone: locationTimezone }),
  );
  tomorrow.setDate(tomorrow.getDate() + 1);
  const forecastDate = tomorrow.toISOString().split("T")[0];

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
  }

  // Send confirmation message
  await sendWhatsAppMessage(
    phoneNumber,
    "Thanks for your response. You won't receive tomorrow's forecast.",
  );

  console.log(
    `Forecast denial recorded for ${location.name} from ${phoneNumber}`,
  );
}

// POST endpoint - receives WhatsApp messages from Twilio
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries());

    console.log("WhatsApp webhook received:", body);

    // Extract phone number, message, and button payload (for Quick Reply buttons)
    const phoneNumber = normalizePhoneNumber(
      body.From?.toString() || body.WaId?.toString(),
    );
    const messageBody = body.Body?.toString() || "";
    const buttonPayload = body.ButtonPayload?.toString() || ""; // Quick Reply button ID

    if (!phoneNumber) {
      console.error("No phone number found in webhook");
      return NextResponse.json({ error: "No phone number" }, { status: 400 });
    }

    console.log(
      `Message from ${phoneNumber}: "${messageBody}"${buttonPayload ? ` | Button: ${buttonPayload}` : ""}`,
    );

    // Get all possible variations of the phone number
    const phoneVariations = getPhoneVariations(phoneNumber);
    console.log(`Trying phone variations:`, phoneVariations);

    // REAL FORECAST FLOW
    if (
      buttonPayload === "forecast-accept" ||
      buttonPayload === "forecast-cancel"
    ) {
      console.log("Processing Real Forecast Quick Reply button");

      if (buttonPayload === "forecast-accept") {
        console.log("Quick Reply button: forecast-accept");
        await handleForecastApproval(phoneNumber, phoneVariations);
        return NextResponse.json({
          status: "forecast_approved",
          processed: true,
          source: "quick_reply",
        });
      } else if (buttonPayload === "forecast-cancel") {
        console.log("Quick Reply button: forecast-cancel");
        await handleForecastDenial(phoneNumber, phoneVariations);
        return NextResponse.json({
          status: "forecast_denied",
          processed: true,
          source: "quick_reply",
        });
      }
    }

    //DEMO FLOW
    if (buttonPayload === "demo-accept" || buttonPayload === "demo-cancel") {
      console.log("Processing demo Quick Reply button");

      // Check if there's a pending demo request for this phone number (try all variations)
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

      console.log(`Found ${demoRequests?.length || 0} pending demo requests`);
      if (demoRequests && demoRequests.length > 0) {
        console.log(
          `Match found! DB phone: ${demoRequests[0].phone}, Webhook phone: ${phoneNumber}`,
        );
      }

      // If there's a pending request, check if message is a response
      if (demoRequests && demoRequests.length > 0) {
        const demoRequest = demoRequests[0];

        // Check Quick Reply button press first (priority)
        if (buttonPayload === "demo-accept") {
          console.log("Quick Reply button: demo-accept");
          await handleApproval(phoneNumber, demoRequest);
          return NextResponse.json({
            status: "approved",
            processed: true,
            source: "quick_reply",
          });
        } else if (buttonPayload === "demo-cancel") {
          console.log("Quick Reply button: demo-cancel");
          await handleDenial(phoneNumber, demoRequest);
          return NextResponse.json({
            status: "denied",
            processed: true,
            source: "quick_reply",
          });
        }
        // If no button pressed, check text message
        else if (isApprovalMessage(messageBody)) {
          console.log("Detected approval response from text");
          await handleApproval(phoneNumber, demoRequest);
          return NextResponse.json({
            status: "approved",
            processed: true,
            source: "text",
          });
        } else if (isDenialMessage(messageBody)) {
          console.log("Detected denial response from text");
          await handleDenial(phoneNumber, demoRequest);
          return NextResponse.json({
            status: "denied",
            processed: true,
            source: "text",
          });
        } else {
          // User sent a message but it's not a clear yes/no
          await sendWhatsAppMessage(
            phoneNumber,
            `I didn't understand your response. Please click one of the buttons or reply with "yes" to receive the forecast or "no" to cancel.`,
          );
          return NextResponse.json({ status: "waiting_for_clear_response" });
        }
      }
    }
    // No pending demo request - could handle other conversational flows here
    console.log("No pending demo request for this number");
    return NextResponse.json({ status: "no_pending_request" });
  } catch (error) {
    console.error("Error processing WhatsApp webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET endpoint - Twilio webhook verification
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const hubChallenge = url.searchParams.get("hub.challenge");

  if (hubChallenge) {
    return new NextResponse(hubChallenge, { status: 200 });
  }

  return NextResponse.json({ status: "WhatsApp webhook endpoint" });
}
