// app/api/send-whatsapp/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    const idInstance = process.env.GREEN_API_ID;
    const apiTokenInstance = process.env.GREEN_API_TOKEN;
    const chatId = "120363314828973505@c.us"; // Your Admin phone number

    const url = `https://7107.api.greenapi.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: chatId,
        message: message,
      }),
    });

    if (!response.ok) throw new Error("Green API failed");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}