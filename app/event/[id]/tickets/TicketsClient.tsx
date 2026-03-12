"use client";

import { useEffect } from "react";

export default function TicketsClient({ evtid }: { evtid: string }) {
  useEffect(() => {
    // Get the container where the TicketNetwork map widget will render
    const container = document.getElementById("tn-map-widget");
    if (!container) return;

    // Clear any previous content if navigating between events
    container.innerHTML = "";

    // Prevent loading the widget script multiple times
    const existingScript = document.querySelector(
      'script[data-tn-mapwidget="true"]',
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.remove();
    }

    // Read TicketNetwork credentials from environment variables
    const bid = process.env.NEXT_PUBLIC_TN_BID; // Your broker ID
    const siteNumber = process.env.NEXT_PUBLIC_TN_SITE_NUMBER; // Your site number

    if (!bid || !siteNumber) {
      console.warn(
        "Missing NEXT_PUBLIC_TN_BID or NEXT_PUBLIC_TN_SITE_NUMBER environment variables.",
      );
      return;
    }

    // Optional configuration block for the Seatics map widget
    const configScript = document.createElement("script");
    configScript.type = "text/javascript";
    configScript.text = `
      window.Seatics = window.Seatics || {};
      window.Seatics.config = window.Seatics.config || {};

      // Example: customize checkout URL if needed
      // Seatics.config.checkoutUrl = "https://tickettransaction2.com/Checkout.aspx";

      // Example: customize buy button text
      // Seatics.config.buyButtonContentHtml = 'Buy Tickets';
    `;
    container.appendChild(configScript);

    // Create the TicketNetwork map widget script
    const script = document.createElement("script");
    script.setAttribute("data-tn-mapwidget", "true");
    script.src = `https://tickettransaction.com/?bid=${encodeURIComponent(
      bid,
    )}&sitenumber=${encodeURIComponent(
      siteNumber,
    )}&tid=ticket_results4&evtid=${encodeURIComponent(evtid)}`;
    script.async = true;

    // Append the script to the container
    container.appendChild(script);

    // Cleanup when the component unmounts or the event changes
    return () => {
      script.remove();
      configScript.remove();
      container.innerHTML = "";
    };
  }, [evtid]);

  return (
    <div
      id="tn-map-widget"
      style={{
        width: "100%",
        maxWidth: 1500,
        height: 900, // recommended height from TicketNetwork documentation
        marginTop: 20,
      }}
    />
  );
}
