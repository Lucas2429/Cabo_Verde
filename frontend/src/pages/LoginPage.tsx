import { useState } from "react";
import axios from "axios";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import DepartmentSelect from "../components/DepartmentSelect";
import type { Department } from "../types/departments";

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
      if (serverMessage.includes("department must be")) {
        return "Selecciona un departamento válido.";
      }
      if (serverMessage.includes("username must be")) {
        return "El usuario debe tener al menos 3 caracteres.";
      }
      return serverMessage;
    }
  }
  return "Ocurrió un error. Intenta nuevamente.";
};

const inputClass = "field";

function LoginPage() {
  const { username: currentUser, login, register } = useAuth();
  const navigate = useNavigate();
  // Si una ruta protegida lo mandó al login, después de entrar vuelve a ella.
  const location = useLocation();
  const fromLocation = (
    location.state as { from?: { pathname: string; search?: string } } | null
  )?.from;
  const from = fromLocation
    ? `${fromLocation.pathname}${fromLocation.search ?? ""}`
    : "/";

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState<Department | "">("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay sesión no tiene sentido mostrar el login.
  if (currentUser) {
    return <Navigate to={from} replace />;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (mode === "register" && !department) {
      setError("Selecciona tu departamento.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), email.trim(), password, department as Department);
      }
      // replace: el login no queda en el historial, así "atrás" no vuelve a él.
      navigate(from, { replace: true });
    } catch (err) {
      setError(describeError(err, mode));
      setSubmitting(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 cursor-pointer rounded-full py-2 text-sm font-semibold transition-colors ${
      active
        ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-300"
        : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
    }`;

  return (
    <div className="app-bg items-center justify-center px-4 py-10">
      <h1 className="mb-6 text-center font-display text-4xl leading-none tracking-wide md:text-5xl">
        <span className="gradient-text">HIJOS DE LA (PUNTO).FOO</span>
      </h1>

      <div className="surface w-full max-w-md p-6 shadow-xl shadow-indigo-500/10 md:p-8">
        <div className="mb-6 flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800" role="tablist">
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
            <label htmlFor="username" className="field-label">
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
              <label htmlFor="email" className="field-label">
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
            <label htmlFor="password" className="field-label">
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

          {mode === "register" && (
            <div>
              <label htmlFor="department" className="field-label">
                Departamento
              </label>
              <DepartmentSelect
                id="department"
                value={department}
                onChange={(d) => {
                  setDepartment(d);
                  setError(null);
                }}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting
              ? "Un momento..."
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta y entrar"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link to="/" className="font-medium text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
            Continuar como invitado
          </Link>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            Los invitados pueden ver memes, pero no subirlos.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
