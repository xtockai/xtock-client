import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import twilio from "twilio";
import { advancedForecast } from "@/lib/forecasting";

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
  return handleDemoApproval(request);
}

export async function POST(request: NextRequest) {
  return handleDemoApproval(request);
}

async function handleDemoApproval(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    console.log(`Demo approve request received. Query params:`, queryParams);

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
            "No pending demo request found for this phone number. Please request a new demo.",
        },
        { status: 404 }
      );
    }

    const demoRequest = demoRequests[0];
    const restaurant = demoRequest.restaurant;

    console.log(`Found demo request for restaurant: ${restaurant}`);

    // Query sales_demo for this restaurant
    const { data: salesData, error: salesError } = await supabase
      .from("sales_demo")
      .select("date, item, quantity")
      .eq("restaurant", restaurant)
      .order("date", { ascending: true });

    if (salesError) {
      console.error("Error fetching sales demo data:", salesError);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    if (!salesData || salesData.length === 0) {
      console.error(`No sales data found for restaurant: ${restaurant}`);
      return NextResponse.json({
        error: "No sales data available for this restaurant",
      });
    }

    // Generate forecast using advanced model
    const forecast = advancedForecast(salesData);

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

    // Send WhatsApp using Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && twilioPhoneNumber) {
      try {
        const client = twilio(accountSid, authToken);

        // Split message if it exceeds 1600 characters
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

          // Send all parts
          for (const part of parts) {
            await client.messages.create({
              body: part,
              from: `whatsapp:${twilioPhoneNumber}`,
              to: `whatsapp:${phoneNumber}`,
            });
          }
        }

        console.log(`Forecast sent successfully to ${phoneNumber}`);
      } catch (whatsappError) {
        console.error("Error sending WhatsApp:", whatsappError);
        return NextResponse.json(
          { error: "Failed to send WhatsApp" },
          { status: 500 }
        );
      }
    } else {
      console.log(
        `Twilio not configured. Would send WhatsApp to ${phoneNumber}:`,
        message
      );
    }

    // Update the request status to 'finished'
    const { error: updateError } = await supabase
      .from("demo_whatsapp_request")
      .update({ status: "finished", updated_at: new Date().toISOString() })
      .eq("id", demoRequest.id);

    if (updateError) {
      console.error("Error updating demo request status:", updateError);
      return NextResponse.json(
        { error: "Error updating request status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Forecast sent successfully!",
      restaurant,
      phone_number: phoneNumber,
      forecast,
    });
  } catch (error) {
    console.error(`Error processing demo approval:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
