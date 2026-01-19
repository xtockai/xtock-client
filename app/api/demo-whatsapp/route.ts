import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import twilio from "twilio";

// POST /api/demo-whatsapp
export async function POST(req: NextRequest) {
  try {
    const { restaurant, phone } = await req.json();

    if (!restaurant || !phone) {
      return NextResponse.json(
        { success: false, error: "Missing restaurant or phone" },
        { status: 400 }
      );
    }

    // Verify that there is data for this restaurant
    const { data: salesData, error } = await supabase
      .from("sales_demo")
      .select("date, item, quantity")
      .eq("restaurant", restaurant)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching sales demo data:", error);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    if (!salesData || salesData.length === 0) {
      return NextResponse.json({
        success: false,
        error:
          "There is no information for this restaurant at the moment, it is not possible to send the forecast",
      });
    }

    // Create a pending request in the database
    const { data: requestData, error: insertError } = await supabase
      .from("demo_whatsapp_request")
      .insert([
        {
          phone,
          restaurant,
          status: "pending",
        },
      ])
      .select();

    if (insertError) {
      console.error("Error creating WhatsApp request:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to create request" },
        { status: 500 }
      );
    }

    // Send WhatsApp message using Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && twilioPhoneNumber) {
      try {
        const client = twilio(accountSid, authToken);

        // Send conversational message
        const message = `👋 Hello! Welcome to Xtock Sales Forecast Demo for *${restaurant}*.\n\n` +
          `📊 We can send you a personalized sales forecast based on your historical data.\n\n` +
          `Would you like to receive your forecast? Please reply with:\n` +
          `• *Yes* or *Approve* to receive it\n` +
          `• *No* or *Deny* to skip it`;

        await client.messages.create({
          body: message,
          from: `whatsapp:${twilioPhoneNumber}`,
          to: `whatsapp:${phone}`,
        });

        return NextResponse.json({
          success: true,
          message: "WhatsApp message sent! Please reply to continue.",
        });
      } catch (whatsappError) {
        console.error("Error sending WhatsApp message:", whatsappError);
        return NextResponse.json(
          { success: false, error: "Failed to send WhatsApp message" },
          { status: 500 }
        );
      }
    } else {
      console.log(
        `Twilio not configured. Would send WhatsApp message to ${phone}`
      );
      return NextResponse.json({
        success: true,
        message: "Demo mode: Request created (WhatsApp not configured)",
      });
    }
  } catch (error) {
    console.error("Error in demo WhatsApp:", error);
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
