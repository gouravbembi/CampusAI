import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SiteRoutes } from "./workspace/routes";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <StrictMode>
    <SiteRoutes />
  </StrictMode>,
);
