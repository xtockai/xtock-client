import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
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
  let cleaned = phoneNumber.replace("whatsapp:", "");

  // Add + if missing
  if (!cleaned.startsWith("+")) {
    cleaned = `+${cleaned}`;
  }

  return cleaned;
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

    // Check if there's a pending demo request for this phone number
    const { data: demoRequests, error: requestError } = await supabase
      .from("demo_whatsapp_request")
      .select("*")
      .eq("phone", phoneNumber)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (requestError) {
      console.error("Error fetching demo request:", requestError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // If there's a pending request, check if message is a response
    if (demoRequests && demoRequests.length > 0) {
      const demoRequest = demoRequests[0];

      if (buttonPayload === "forecast-accept") {
        console.log("Quick Reply button: forecast-accept");
        await handleApproval(phoneNumber, demoRequest);
        return NextResponse.json({
          status: "approved",
          processed: true,
          source: "quick_reply",
        });
      } else if (buttonPayload === "forecast-cancel") {
        console.log("Quick Reply button: forecast-cancel");
        await handleDenial(phoneNumber, demoRequest);
        return NextResponse.json({
          status: "denied",
          processed: true,
          source: "quick_reply",
        });
      }

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
