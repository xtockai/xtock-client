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
        { status: 400 },
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
        { status: 500 },
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
        { status: 500 },
      );
    }

    // Send WhatsApp template message using Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    // New Quick Reply template with buttons: "Yes" (ID: demo-accept) and "Cancel" (ID: demo-cancel)
    const contentSid = "HX7939e5aeac921c8d44faf8060c0b8188"; // TODO: Replace with new Quick Reply template SID

    if (accountSid && authToken && twilioPhoneNumber) {
      try {
        const client = twilio(accountSid, authToken);

        // Send template message with buttons (required by WhatsApp policy)
        // Note: Users can also reply with text (yes/no) which will be handled by the webhook
        await client.messages.create({
          contentSid: contentSid,
          from: `whatsapp:${twilioPhoneNumber}`,
          to: `whatsapp:${phone}`,
        });

        return NextResponse.json({
          success: true,
          message:
            "WhatsApp template sent! User can click buttons or reply with text (yes/no).",
        });
      } catch (whatsappError) {
        console.error("Error sending WhatsApp template:", whatsappError);
        return NextResponse.json(
          { success: false, error: "Failed to send WhatsApp template" },
          { status: 500 },
        );
      }
    } else {
      console.log(
        `Twilio not configured. Would send WhatsApp template to ${phone}`,
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
      { status: 400 },
    );
  }
}
