import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Simple forecasting function
function predictTomorrowSales(
  historicalData: { date: string; item: string; quantity: number }[]
): { [item: string]: number } {
  // Group by item
  const itemData: { [item: string]: number[] } = {};

  historicalData.forEach((record) => {
    if (!itemData[record.item]) {
      itemData[record.item] = [];
    }
    itemData[record.item].push(record.quantity);
  });

  // For each item, calculate average of last 7 days (or all if less)
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

    // Query sales_demo for this restaurant
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

    // TODO: Actually send WhatsApp message using a service like Twilio, 360Dialog, etc.
    // For now, just log and return success
    console.log(`Would send WhatsApp to ${phone}:`, message);

    return NextResponse.json({
      success: true,
      message: "Forecast sent to WhatsApp!",
      forecast,
    });
  } catch (error) {
    console.error("Error in demo WhatsApp:", error);
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
