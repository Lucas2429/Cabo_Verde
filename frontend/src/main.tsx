import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { setupInterceptors } from "./services/interceptors";

// Debe ir antes de renderizar: así ninguna petición escapa del interceptor.
setupInterceptors();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
