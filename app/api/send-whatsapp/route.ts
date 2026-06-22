import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Validate the Request Body
    if (!request.body) {
      return NextResponse.json({ success: false, error: "Empty request body" }, { status: 400 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: "Missing 'message' field in payload" }, { status: 400 });
    }

    // 2. Validate Environment Variables
    const idInstance = process.env.GREEN_API_ID;
    const apiTokenInstance = process.env.GREEN_API_TOKEN;

    if (!idInstance || !apiTokenInstance) {
      console.error("API Error: Missing Green API credentials in environment variables.");
      return NextResponse.json({ 
        success: false, 
        error: "Server configuration error: Missing API keys" 
      }, { status: 500 });
    }

    // 3. Define the Chat ID
    // CRITICAL FIX REMINDER: If 120363314828973505 is a GROUP chat, it MUST end in @g.us, not @c.us
    const chatId = "120363314828973505@g.us"; 

    const url = `https://7107.api.greenapi.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;

    // 4. Execute the fetch request to Green API
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: chatId,
        message: message,
      }),
    });

    // 5. Handle Green API Rejections
    if (!response.ok) {
      // Extract the exact error message Green API sent back
      const errorText = await response.text(); 
      console.error(`Green API Rejected Request [Status: ${response.status}]:`, errorText);
      
      return NextResponse.json({ 
        success: false, 
        error: `Green API returned status ${response.status}`,
        details: errorText // This will tell you exactly why Green API failed
      }, { status: response.status });
    }

    // 6. Handle Success
    const responseData = await response.json();
    console.log("WhatsApp message sent successfully. Message ID:", responseData.idMessage);

    return NextResponse.json({ 
      success: true,
      idMessage: responseData.idMessage 
    });

  } catch (error: any) {
    // 7. Handle Server/Network Crashes (e.g., fetch failed entirely)
    console.error("WhatsApp API Route Crash:", error);
    
    return NextResponse.json({ 
      success: false, 
      error: "Internal Server Error",
      message: error.message || "An unexpected error occurred"
    }, { status: 500 });
  }
}