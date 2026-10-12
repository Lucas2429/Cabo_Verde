import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "localhost";
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || "my_secret";

// LAB 8 - P3: entorno de ejecución. Se define al iniciar el backend
// (ver scripts "start:test" y "dev:test" en package.json).
const NODE_ENV = process.env.NODE_ENV;

// LAB 8 - P3: selección de la base de datos según el entorno.
// - Entorno de pruebas (NODE_ENV=test): se usa MONGODB_DBNAME_TEST, así los
//   tests E2E nunca tocan los datos reales.
// - Cualquier otro entorno: se usa MONGODB_DBNAME como siempre.
const MONGODB_DBNAME =
  NODE_ENV === "test"
    ? process.env.MONGODB_DBNAME_TEST
    : process.env.MONGODB_DBNAME;

export default { PORT, HOST, MONGODB_URI, MONGODB_DBNAME, JWT_SECRET, NODE_ENV };
