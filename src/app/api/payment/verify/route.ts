import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const reference = searchParams.get("reference") || searchParams.get("trxref");

        if (!reference) {
            return NextResponse.json({ error: "No reference provided" }, { status: 400 });
        }

        // FIX: await the server client
        const supabase = await createClient();

        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
        });

        const data = await response.json();

        if (!data.status || data.data.status !== "success") {
            return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
        }

        const bookingId = data.data.metadata?.booking_id;

        if (bookingId) {
            await supabase.from("bookings").update({ status: "confirmed" }).eq("id", bookingId);
        }

        return NextResponse.json({ success: true, data: data.data });
    } catch (error) {
        console.error("Payment verify error:", error);
        return NextResponse.json({ error: "Verification failed" }, { status: 500 });
    }
}