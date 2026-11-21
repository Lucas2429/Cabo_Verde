// Cambia el rol de un usuario. Es la ÚNICA forma de crear admins: el rol no se
// puede elegir al registrarse ni desde la web.
//
//   npm run set-role -- <usuario> admin     (hacerlo admin)
//   npm run set-role -- <usuario> user      (quitarle el rol)
//
// Usa la base de datos del .env (MONGODB_DBNAME). Con NODE_ENV=test usa la de
// pruebas (MONGODB_DBNAME_TEST). Si el usuario tiene una sesión abierta, el
// cambio rige al instante en el backend; en el navegador, al recargar la página.
import mongoose from "mongoose";
import User, { ROLES, type Role } from "../models/user";
import config from "../utils/config";

const isRole = (value: string | undefined): value is Role =>
  value !== undefined && (ROLES as readonly string[]).includes(value);

const main = async (): Promise<number> => {
  const [username, role] = process.argv.slice(2);

  if (!username || !isRole(role)) {
    console.error(`Uso: npm run set-role -- <usuario> <${ROLES.join("|")}>`);
    return 1;
  }
  if (!config.MONGODB_URI) {
    console.error("Falta MONGODB_URI en el .env");
    return 1;
  }

  await mongoose.connect(config.MONGODB_URI, { dbName: config.MONGODB_DBNAME });
  try {
    const user = await User.findOne({ username });
    if (!user) {
      console.error(`No existe ningún usuario con el nombre "${username}".`);
      return 1;
    }

    user.role = role;
    await user.save();
    console.log(`@${user.username} ahora tiene el rol "${role}" (BD: ${config.MONGODB_DBNAME}).`);
    return 0;
  } finally {
    await mongoose.disconnect();
  }
};

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
