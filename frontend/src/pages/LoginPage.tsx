import { useState } from "react";
import axios from "axios";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";

type Mode = "login" | "register";

const describeError = (error: unknown, mode: Mode): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "No se pudo conectar con el servidor.";
    }
    const { status, data } = error.response;
    const serverMessage = (data as { error?: unknown } | undefined)?.error;

    if (mode === "login" && status === 401) {
      return "Usuario o contraseña incorrectos.";
    }
    if (typeof serverMessage === "string") {
      if (serverMessage.includes("unique")) {
        return serverMessage.includes("email")
          ? "Ese correo ya está registrado."
          : "Ese nombre de usuario ya existe.";
      }
      if (serverMessage.includes("invalid email")) {
        return "El correo no es válido.";
      }
      if (serverMessage.includes("password must be")) {
        return "La contraseña debe tener al menos 3 caracteres.";
      }
      if (serverMessage.includes("username must be")) {
        return "El usuario debe tener al menos 3 caracteres.";
      }
      return serverMessage;
    }
  }
  return "Ocurrió un error. Intenta nuevamente.";
};

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";

function LoginPage() {
  const { username: currentUser, login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay sesión no tiene sentido mostrar el login.
  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), email.trim(), password);
      }
      navigate("/");
    } catch (err) {
      setError(describeError(err, mode));
      setSubmitting(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 py-2 text-sm font-semibold rounded-full transition-colors cursor-pointer ${
      active ? "bg-[#5a6c8a] text-white shadow" : "text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div className="bg-[#5a6c8a] min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="bg-[#dadada] text-center py-4 px-6 rounded-full w-full max-w-md shadow-md mb-6">
        <h1 className="text-lg md:text-xl font-bold tracking-wide text-gray-800 uppercase">
          HIJOS DE LA (PUNTO).FOO
        </h1>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[30px] border-4 border-gray-800 w-full max-w-md shadow-2xl">
        <div className="flex gap-1 bg-gray-100 rounded-full p-1 mb-6" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => switchMode("login")}
            className={tabClass(mode === "login")}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            onClick={() => switchMode("register")}
            className={tabClass(mode === "register")}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              value={username}
              autoComplete="username"
              required
              minLength={3}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                autoComplete="email"
                required
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={3}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#5a6c8a] hover:bg-[#485770] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow-md"
          >
            {submitting
              ? "Un momento..."
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta y entrar"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link to="/" className="text-indigo-600 hover:text-indigo-800 underline">
            Continuar como invitado
          </Link>
          <p className="text-[11px] text-gray-400 mt-1">
            Los invitados pueden ver memes, pero no subirlos.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
