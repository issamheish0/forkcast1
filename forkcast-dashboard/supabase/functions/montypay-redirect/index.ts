// Supabase Edge Function: montypay-redirect
// Redirects from MontyPay checkout back to the app via deep link
// MontyPay requires HTTPS URLs, so we use this as an intermediary

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// App deep link base for redirecting to the app
const APP_DEEP_LINK_BASE = Deno.env.get("APP_DEEP_LINK_BASE") || "plate://";

Deno.serve((req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "unknown";
    const path = url.searchParams.get("path") || "profile/payment-methods";

    console.log("[montypay-redirect] Redirecting to app:");
    console.log("- Status:", status);
    console.log("- Path:", path);

    // Build the deep link URL to redirect to the app
    const deepLink = `${APP_DEEP_LINK_BASE}${path}?payment_status=${status}`;
    console.log("- Deep link:", deepLink);

    // Ultra-minimal HTML - just the essentials for redirect
    // Some browsers have issues with complex HTML in redirects
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${deepLink}">
<title>Redirecting...</title>
</head>
<body>
<p>Redirecting to Plate app...</p>
<p><a href="${deepLink}">Tap here if not redirected</a></p>
<script>window.location.replace("${deepLink}");</script>
</body>
</html>`;

    // Return response with explicit headers
    return new Response(html, {
      status: 200,
      headers: new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }),
    });
  } catch (error) {
    console.error("[montypay-redirect] Error:", error);

    return new Response(
      "<html><body><h1>Error</h1><p>Please return to the app.</p></body></html>",
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
});
