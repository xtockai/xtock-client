import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const { orgId, name, apiKey } = await request.json();

    if (!orgId || !name || !apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const encryptedApiKey = encrypt(apiKey);

    const { error } = await supabase.from("credentials").insert({
      organization_id: orgId,
      name,
      api_key: encryptedApiKey,
    });

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to save credentials" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
