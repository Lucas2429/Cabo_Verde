import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
