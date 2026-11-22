import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { AdminRoute, ProtectedRoute } from "./components/RouteGuards";
import AdminReportsPage from "./pages/AdminReportsPage";
import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import PodiumPage from "./pages/PodiumPage";
import ProfilePage from "./pages/ProfilePage";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Rutas públicas: las ve cualquiera, con o sin sesión. */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/podio" element={<PodiumPage />} />
        <Route path="/u/:username" element={<ProfilePage />} />

        {/* Rutas protegidas: primero exigen sesión y luego rol de admin. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminRoute />}>
            <Route path="/admin/reportes" element={<AdminReportsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
