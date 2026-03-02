// testToken.js
import { getToken } from "./lib/tokenManager.js";

(async () => {
  try {
    const token = await getToken();
    console.log("✅ Token generado correctamente:");
    console.log(token);
  } catch (err) {
    console.error("❌ Error generando token:", err.message);
  }
})();