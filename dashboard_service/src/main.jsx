import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import AppAgent from "./AppAgent.jsx";
import { ColorModeProvider } from "./ColorModeContext.jsx";

const isAgentMode = import.meta.env.MODE === "agent";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ColorModeProvider>
      <BrowserRouter>
        {isAgentMode ? (
          <AppAgent />
        ) : (
          <Routes>
            <Route path="*" element={<App />} />
          </Routes>
        )}
      </BrowserRouter>
    </ColorModeProvider>
  </StrictMode>
);
