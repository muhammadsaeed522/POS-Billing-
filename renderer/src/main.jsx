import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { BrandingProvider } from "./context/BrandingContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrandingProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrandingProvider>
  </StrictMode>
);
