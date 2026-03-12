
import React from "react";
import Script from "next/script";

const PolicyPage = () => (
  <main style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
    <h1>Policy / Terms and Conditions</h1>
    <p>This page contains our policy and terms & conditions.</p>
    {/* Contenedor para el script externo */}
    <div id="external-policy-script"></div>
    <Script
      id="external-policy-script-loader"
      src="http://tickettransaction.com/?bid=4579&sitenumber=23&tid=600"
      strategy="afterInteractive"
    />
  </main>
);

export default PolicyPage;
