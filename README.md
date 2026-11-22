# Cabo_Verde

CC5003 - Aplicaciones Web Reactivas

Sitio de memes estilo Pinterest: cualquiera puede ver los memes, sus comentarios y el podio de la semana, pero solo los usuarios con sesión pueden subir un meme (una imagen + una descripción), comentar o dar like/dislike. Cada usuario tiene un perfil con su foto, su carrera y sus publicaciones, que puede editar y eliminar. Cualquier usuario con sesión puede **reportar** publicaciones y comentarios ajenos; los **administradores** revisan los reportes y moderan el contenido y las cuentas, incluido **banear** usuarios (ver [Moderación](#moderación)).

## Estructura

```
Cabo_Verde/
├── backend/    API REST (Node + Express + TypeScript + MongoDB)
└── frontend/   Aplicación web (React + Vite + TypeScript + Tailwind), una SPA
```

| Parte | Tecnologías principales |
|---|---|
| Backend | Express 5, Mongoose, JWT (`jsonwebtoken`), `bcrypt`, `multer` |
| Frontend | React 19, Vite, React Router, Tailwind CSS 4, Material UI, axios |

## Requisitos

- Node.js y npm
- MongoDB corriendo (por defecto en `mongodb://localhost:27017`)

## Puesta en marcha (desarrollo)

**1. Backend**

```bash
cd backend
npm install
cp env.example .env     # en Windows: copy env.example .env  (y ajustar los valores si hace falta)
npm run dev             # http://localhost:3001
```

Variables del `.env`:

| Variable | Descripción |
|---|---|
| `PORT`, `HOST` | Dónde escucha el backend (por defecto `3001` y `localhost`) |
| `MONGODB_URI` | Conexión a MongoDB |
| `MONGODB_DBNAME` | Base de datos normal |
| `MONGODB_DBNAME_TEST` | Base de datos usada cuando `NODE_ENV=test` |
| `JWT_SECRET` | Clave para firmar las sesiones. **Cambiarla en producción** |

**2. Frontend** (en otra terminal)

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173
```

Vite reenvía las llamadas a `/api` y `/uploads` al backend (ver `frontend/vite.config.ts`). Por eso el navegador siempre habla con un solo origen y no hace falta configurar CORS.

**3. Crear un administrador** (opcional)

El rol no se puede elegir al registrarse ni desde la web: se asigna por consola a un usuario que ya exista.

```bash
cd backend
npm run set-role -- <usuario> admin     # hacerlo admin
npm run set-role -- <usuario> user      # quitarle el rol
```

Usa la base de datos del `.env` (con `NODE_ENV=test`, la de pruebas). El backend lee el rol en cada petición, así que quitarlo rige al instante; en el navegador, el cambio se ve al recargar la página.

## Cómo funciona el backend

Código en `backend/src`:

```
app.ts                  Configuración de Express, rutas y archivos estáticos
index.ts                Arranca el servidor
controllers/
  memes.ts              Listar/filtrar memes, podio, subir, editar y eliminar un meme
  comments.ts           Listar, crear, editar y eliminar comentarios de un meme
  reactions.ts          Poner y quitar like/dislike de un meme
  reports.ts            Reportar un meme o un comentario ajeno
  admin.ts              Rutas de moderación (solo admins): reportes, eliminar, limitar comentarios, bitácora
  users.ts              Registro, perfil público, memes de un usuario y edición del perfil propio
  login.ts              Login, sesión actual y logout
  testing.ts            Reinicio de la BD (solo con NODE_ENV=test)
models/
  memes.ts              Esquema del meme
  comment.ts            Esquema del comentario y withAuthorAvatars (foto del autor)
  reaction.ts           Esquema de la reacción (like/dislike) y conteo de totales
  user.ts               Esquema del usuario (incluye carrera, foto de perfil y rol)
  report.ts             Esquema del reporte (motivos, estados y límites)
  moderationLog.ts      Bitácora de moderación (quién hizo qué y por qué)
scripts/
  setRole.ts            Asigna o quita el rol de admin (npm run set-role)
utils/
  upload.ts             Subida y validación de imágenes (memes y fotos de perfil)
  podium.ts             Arma el podio a partir de los memes de la semana
  week.ts               Calcula la semana en curso (lunes a domingo, hora de Chile)
  middleware.ts         Autenticación (withUser, withAdmin), logger y manejo de errores
  config.ts             Lectura del .env
```

### Endpoints

"Sesión" significa tener la cookie `token` y enviar el header `X-CSRF-Token`; sin eso el backend responde `401`.

| Método | Ruta | Sesión | Descripción |
|---|---|---|---|
| GET | `/api/memes` | No | Lista los memes con sus totales `likes` y `dislikes`. Filtros opcionales: `department` (carrera del **autor**; se puede repetir para combinar varias) y `order` (`newest` por defecto, o `oldest`) |
| GET | `/api/memes/podium` | No | Podio de la semana en curso (ver [Podio semanal](#podio-semanal)) |
| GET | `/api/memes/reactions/mine` | **Sí** | Tus reacciones: `{ "<idDelMeme>": "like" \| "dislike" }` |
| GET | `/api/memes/under-review/mine` | **Sí** | Tu contenido con reportes pendientes: `{ "memes": [ids], "comments": [ids] }` (ver [Moderación](#moderación)) |
| GET | `/api/memes/:id` | No | Un meme (con `likes` y `dislikes`) |
| POST | `/api/memes` | **Sí** | Sube un meme (`multipart/form-data`: `content` e `image`) |
| PATCH | `/api/memes/:id` | **Sí, solo el autor** | Cambia la descripción del meme (JSON: `content`, 1 a 300 caracteres). `403` si no es tuyo, `404` si no existe, `409` si tiene reportes pendientes de revisión |
| DELETE | `/api/memes/:id` | **Sí, solo el autor** | Elimina el meme con sus comentarios, reacciones e imagen. Responde `204`; `403` si no es tuyo, `409` si tiene reportes pendientes de revisión |
| GET | `/api/memes/:id/comments` | No | Lista los comentarios de un meme, del más nuevo al más viejo (con `authorAvatar`) |
| POST | `/api/memes/:id/comments` | **Sí** | Comenta un meme (JSON: `content`, 1 a 300 caracteres, y `parent` opcional para responder a otro comentario). `403` si un admin limitó los comentarios de ese meme |
| PATCH | `/api/memes/:id/comments/:commentId` | **Sí, solo el autor** | Edita un comentario propio (JSON: `content`). `409` si tiene reportes pendientes de revisión |
| DELETE | `/api/memes/:id/comments/:commentId` | **Sí, solo el autor** | Elimina un comentario propio (físico si no tiene respuestas; si las tiene, queda como "Comentario eliminado"). `409` si tiene reportes pendientes de revisión |
| POST | `/api/memes/:id/report` | **Sí** | Reporta un meme ajeno (JSON: `reason` y `details`, ver [Moderación](#moderación)) |
| POST | `/api/memes/:id/comments/:commentId/report` | **Sí** | Reporta un comentario ajeno (mismo formato) |
| POST | `/api/users/:username/report` | **Sí** | Reporta a un usuario ajeno (mismo formato). `403` si eres tú o es admin, `409` si ya lo reportaste o ya está baneado |
| PUT | `/api/memes/:id/reaction` | **Sí** | Pone o cambia tu reacción (JSON: `type` = `like` o `dislike`) |
| DELETE | `/api/memes/:id/reaction` | **Sí** | Quita tu reacción |
| POST | `/api/users` | No | Crea un usuario (`username`, `email`, `password`; opcionales `department`, `displayName`, `description`) |
| GET | `/api/users` | No | Lista los usuarios |
| GET | `/api/users/:username` | No | Perfil público: nombre, descripción, foto, carrera, cantidad de memes y últimos 3 memes (con `likes` y `dislikes`) |
| GET | `/api/users/:username/memes` | No | Todos los memes de un usuario, del más nuevo al más viejo (con `likes` y `dislikes`) |
| PATCH | `/api/users/me` | **Sí** | Edita tu perfil: `displayName`, `description`, foto nueva (`image`, solo con `multipart/form-data`) o `removeAvatar: true` para quitarla. Acepta JSON o `multipart/form-data` |
| POST | `/api/login` | No | Inicia sesión. `403` con `code: "banned"` si la cuenta fue baneada (solo se avisa si la contraseña es correcta) |
| GET | `/api/login/me` | Sí | Datos del usuario de la sesión (incluye su `role`) |
| POST | `/api/login/logout` | No | Cierra la sesión |
| GET | `/api/admin/reports/memes` | **Solo admin** | Posts reportados, agrupados y ordenados de más a menos reportes. `?status=pending` (por defecto) o `resolved` |
| GET | `/api/admin/reports/comments` | **Solo admin** | Comentarios reportados (con el texto original), en el mismo orden. Mismo `status` |
| GET | `/api/admin/reports/alerts` | **Solo admin** | Cuántos posts, comentarios y usuarios tienen `threshold` (5) o más reportes pendientes: `{ threshold, memes, comments, users }` |
| GET | `/api/admin/reports/users` | **Solo admin** | Usuarios reportados, agrupados y en el mismo orden. Mismo `status` |
| POST | `/api/admin/memes/:id/remove` | **Solo admin** | Elimina un post por moderación (JSON: `reason`, 3 a 200 caracteres) |
| PUT | `/api/admin/memes/:id/comments-lock` | **Solo admin** | Limita o permite los comentarios de un post (JSON: `locked`) |
| POST | `/api/admin/memes/:id/dismiss-reports` | **Solo admin** | Descarta los reportes pendientes de un post |
| POST | `/api/admin/comments/:id/remove` | **Solo admin** | Elimina un comentario por moderación (JSON: `reason`) |
| POST | `/api/admin/comments/:id/dismiss-reports` | **Solo admin** | Descarta los reportes pendientes de un comentario |
| POST | `/api/admin/users/:username/ban` | **Solo admin** | Banea a un usuario (JSON: `reason`, 3 a 200 caracteres). `403` si es admin, `409` si ya está baneado |
| POST | `/api/admin/users/:username/unban` | **Solo admin** | Levanta el baneo |
| POST | `/api/admin/users/:username/dismiss-reports` | **Solo admin** | Descarta los reportes pendientes de un usuario |
| GET | `/api/admin/log` | **Solo admin** | Últimas 100 acciones de moderación |
| POST | `/api/testing/reset` | No | Vacía la BD de pruebas. **Solo existe con `NODE_ENV=test`**; en otro entorno responde `404` |
| GET | `/uploads/<archivo>` | No | Sirve las imágenes subidas (memes y fotos de perfil) |

En `backend/requests.rest` hay ejemplos de las peticiones (extensión REST Client de VS Code).

### Sesiones

1. `POST /api/login` valida usuario y contraseña (guardada con `bcrypt`) y entrega un JWT dentro de una **cookie `httpOnly`**, que el navegador envía solo y que el JavaScript de la página no puede leer. Dura 1 hora.
2. Junto con el token se genera un **token CSRF**, que llega en el body y en el header `X-CSRF-Token` de la respuesta.
3. Las rutas protegidas (`withUser` en `middleware.ts`) exigen la cookie **y** que el header `X-CSRF-Token` coincida con el del token. Sin sesión responden `401`.
4. `withUser` también consulta en la base de datos si la cuenta está **baneada**; si lo está, borra la cookie y responde `403` con `code: "banned"`. Se hace en cada petición (y no solo al iniciar sesión) para que un baneo corte el acceso al instante, aunque el token siga vigente.

### Editar y eliminar solo lo propio

`PATCH` y `DELETE` de `/api/memes/:id` comparan el dueño del meme guardado en la base de datos con el usuario de la sesión (que sale del token, nunca de lo que envía el cliente). Si no coinciden responden `403`, así que ocultar los botones en el frontend es solo una comodidad: la regla la aplica el backend. Lo mismo vale para `PATCH /api/users/me`, que siempre edita al usuario de la sesión.

### Likes y dislikes

Cada usuario tiene **como máximo una reacción por meme** (like o dislike), garantizado por un índice único `(meme, usuario)` en MongoDB. Pasar de like a dislike reemplaza la reacción anterior, y repetir la misma la quita. `PUT` y `DELETE` responden `{ type, likes, dislikes }` con el estado ya actualizado, y el usuario sale de la sesión, nunca del body. Los totales se calculan al listar los memes.

> **Importante:** todo endpoint que devuelva memes debe incluir sus `likes` y `dislikes`, ya sea pasando por `withReactionCounts` (en `models/reaction.ts`) o usando `getReactionCounts` (como hace el podio); si no, los memes llegan sin ellos y los contadores salen vacíos. Hoy lo hacen `GET /api/memes`, `GET /api/memes/:id`, `GET /api/memes/podium`, `PATCH /api/memes/:id`, `GET /api/users/:username` y `GET /api/users/:username/memes`.

### Comentarios y fotos de autor

Los comentarios guardan solo el nombre del autor y su id. La foto de perfil **no se copia** en cada comentario: `withAuthorAvatars` (en `models/comment.ts`) la busca en la colección de usuarios al responder y la entrega como `authorAvatar` (`null` si no tiene). Así, si alguien cambia su foto, todos sus comentarios anteriores la muestran. Todo endpoint que devuelva comentarios debe pasar por esa función.

### Moderación

Hay **un solo nivel de moderación: `admin`** (administrador/moderador). El rol vive en el usuario (`role`, por defecto `user`) y solo se asigna con `npm run set-role`. Las rutas de `/api/admin` pasan por `withAdmin` (`utils/middleware.ts`): validan la sesión y **leen el rol de la base de datos en cada petición** (no del token); un usuario normal recibe `403`. Esconder las opciones en el frontend es solo comodidad, igual que con editar y eliminar lo propio.

**Reportes** (`controllers/reports.ts`, `models/report.ts`)

- Se pueden reportar memes, comentarios y usuarios **ajenos**. El motivo es una lista cerrada: `hate`, `fraud`, `fake_news`, `harassment` u `other`. Con `other` hay que explicar cuál en `details` (máx. 200 caracteres). Los textos que ve el usuario están en `frontend/src/types/report.ts`.
- Reglas anti-abuso: no se puede reportar lo propio (`403`), un usuario reporta cada contenido (o a cada usuario) **una sola vez** (`409`; lo garantiza un índice único) y hay un tope de 20 reportes por hora entre todos los tipos (`429`). Los **admins no se pueden reportar** (`403`, ningún admin puede moderar a otro, así que el reporte no tendría quién lo resuelva) y un usuario ya baneado tampoco (`409`). Los errores traen un `code` estable (`own_content`, `admin_target`, `user_banned`, `already_reported`, `too_many_reports`) que el frontend usa para mostrar el mensaje.
- Los tres tipos comparten el mismo modelo (`targetType`: `meme`, `comment` o `user`) y los mismos estados: `pending` (sin revisar), `accepted` (un admin actuó: eliminó el contenido o baneó al usuario) y `dismissed` (un admin decidió no actuar). Cada reporte guarda el **autor del contenido** (o el propio usuario reportado) al crearse. En los reportes de usuario `meme` y `comment` son `null`, por eso el índice único incluye el tipo y el autor; al arrancar, el backend ejecuta `ReportModel.syncIndexes()` (`app.ts`) para reemplazar el índice antiguo (`reporter + meme + comment`), que impediría reportar a más de un usuario.

**Acciones de los admins** (`controllers/admin.ts`)

- **Eliminar un post** es un "borrado con huella": el meme no se borra de la base de datos, se marca (`removedAt`, `removedBy`, `removalReason`) y desaparece de todas las consultas normales. Esto lo hace un filtro automático en `models/memes.ts` (`find`, `findOne`, `countDocuments`), de modo que la galería, el podio, los perfiles, los comentarios y las reacciones lo ignoran sin que cada endpoint tenga que acordarse. Las rutas de admin que necesitan verlo usan `.setOptions({ includeRemoved: true })`. El motivo es obligatorio.
- **Eliminar un comentario** funciona igual, pero nunca se borra del hilo: queda como **"Comentario eliminado"** (como en Reddit), con sus respuestas debajo. El texto original se conserva en `content` y solo lo ven los admins; al público `toJSON` le entrega el comentario como eliminado (`models/comment.ts`).
- **Limitar comentarios** (como en Instagram): el post y sus comentarios se siguen viendo, pero nadie puede comentar ni responder (`POST` devuelve `403`). Se puede revertir.
- **Descartar reportes**: los pasa a `dismissed`. Eliminar un post acepta sus reportes pendientes y deja como `dismissed` los de sus comentarios (el post ya no existe); eliminar un comentario acepta sus reportes pendientes.
- **Orden:** las listas de reportes de posts, comentarios y usuarios van de **más a menos reportes** (en empate, primero el que recibió un reporte más reciente). El orden y el tope de 100 se calculan en la base de datos con una agregación, antes de traer los reportes, así los contenidos con más reportes nunca quedan fuera por ser antiguos.
- **Alerta:** un post, comentario o usuario queda **en alerta** cuando tiene `REPORT_ALERT_THRESHOLD` (5) o más reportes **pendientes** (y sigue activo). **El umbral está definido solo en el backend** (`models/report.ts`): cada elemento de las listas de reportes trae `inAlert` ya calculado, y `GET /api/admin/reports/alerts` devuelve el umbral y cuántos hay en alerta de cada tipo (`{ threshold, memes, comments, users }`). El frontend solo muestra esos datos: una marca roja con el total en el botón "Reportes" del header, y otra en cada pestaña.
- **Banear usuarios** (`POST /api/admin/users/:username/ban`): la cuenta guarda `bannedAt`, `bannedBy` y `banReason` (el motivo es obligatorio y solo lo ven los admins; el perfil público solo expone `banned: true`). Una cuenta baneada **no puede iniciar sesión** (`403` con `code: "banned"`, solo si la contraseña es correcta, para no revelar a un tercero quién está baneado) y **pierde la sesión abierta al instante**: `withUser` consulta el baneo en cada petición. Sus memes y comentarios **no se tocan** (para eso están las acciones sobre cada contenido). Los reportes pendientes contra él pasan a `accepted`. El baneo se puede levantar (`unban`), y un admin **no puede ser baneado** (`403`). Banear, desbanear y descartar quedan en la bitácora.
- Un admin **no puede moderar a otro admin ni su contenido** (`403`).
- Toda acción queda en la **bitácora** (`models/moderationLog.ts`, `GET /api/admin/log`): quién, qué, sobre qué y con qué motivo.
- **Contenido con reportes pendientes:** mientras un post o comentario tenga reportes `pending`, su **autor no puede editarlo ni eliminarlo**: `PATCH` y `DELETE` responden `409` con `code: "pending_reports"` (helpers `memeHasPendingReports` y `commentHasPendingReports` en `models/report.ts`). Si no, bastaría corregir o borrar justo lo reportado para que el admin termine revisando otra cosa. Se desbloquea cuando un admin resuelve los reportes (descartar o eliminar). Solo cuentan los reportes del propio contenido: los de los comentarios de un meme no bloquean al meme. `GET /api/memes/under-review/mine` le entrega al autor los ids de lo suyo que está en revisión, para que el frontend bloquee los botones y explique por qué (solo devuelve lo propio). Un contenido que un admin ya eliminó tampoco se puede editar ni borrar por su autor, así la evidencia queda intacta.
- Cuando el autor borra su contenido (ya sin reportes pendientes), también se borran sus reportes descartados. Los `accepted` **se conservan**, por ejemplo los de comentarios de otros usuarios que un admin eliminó y cuyo meme luego se borra: quedan como historial de la moderación.

> **Importante:** el archivo de imagen de un meme eliminado por moderación **sigue en `backend/uploads/`** (es la evidencia) y se puede abrir si alguien conoce su URL exacta (un nombre aleatorio). Solo deja de aparecer en la app.

### Podio semanal

`GET /api/memes/podium` responde `{ weekStart, weekEnd, podium: [{ position, likes, memes }] }`.

- La semana va de **lunes 00:00 a domingo 23:59, hora de Chile** (`America/Santiago`), sin importar la zona horaria del servidor (`utils/week.ts`).
- Cuentan los memes **publicados esa semana**, ordenados por likes (los dislikes no restan). Un meme sin likes no entra.
- El podio tiene hasta 3 puestos. **Los empates comparten puesto** y el ranking es denso: si dos memes empatan en el primer lugar, el segundo lugar es el siguiente número de likes. Dentro de un puesto se ordenan por menos dislikes y luego por antigüedad (`utils/podium.ts`).

### Subida de imágenes

Al hacer `POST /api/memes` (o `PATCH /api/users/me` con una foto de perfil) el backend:

1. Comprueba la sesión **antes** de recibir el archivo, así un invitado no puede subir nada.
2. Acepta una sola imagen JPG, PNG, WEBP o GIF de **máximo 2 MB** (si se pasa responde `413`).
3. Verifica que el contenido real sea una imagen (no solo el tipo que declara el navegador).
4. Guarda el archivo en `backend/uploads/` con un nombre aleatorio. En MongoDB solo se guarda la URL (`/uploads/<archivo>`), así la base de datos no crece con archivos pesados.
5. Toma el autor de la sesión, no de lo que envía el cliente.

Al reemplazar o quitar una foto de perfil, la imagen anterior se borra del disco; al eliminar un meme, también se borra su imagen. La carpeta `uploads/` no está en git: hay que respaldarla junto con la base de datos.

## Cómo funciona el frontend

Es una SPA: React Router resuelve las rutas en el navegador y nunca se recarga la página. Rutas: `/` (galería), `/login`, `/podio` (podio de la semana), `/u/:username` (perfil) y `/admin/reportes` (vista de reportes, solo admins).

Código en `frontend/src`:

```
main.tsx / App.tsx      Punto de entrada y rutas
pages/
  Home.tsx              Galería de memes (ruta /)
  LoginPage.tsx         Iniciar sesión y crear cuenta (ruta /login)
  PodiumPage.tsx        Podio de la semana (ruta /podio)
  ProfilePage.tsx       Perfil de un usuario y sus publicaciones (ruta /u/:username)
  AdminReportsPage.tsx  Vista de reportes con pestañas Posts / Comentarios / Usuarios (ruta /admin/reportes, solo admins)
components/
  Header.tsx            Barra superior compartida (podio, botón "Reportes" para admins, perfil y foto del usuario)
  RouteGuards.tsx       ProtectedRoute (exige sesión) y AdminRoute (exige rol admin) para las rutas protegidas
  BannedNotice.tsx      Aviso global (arriba de toda la app) cuando una cuenta es baneada mientras se usa el sitio
  CategoryBar.tsx       Categorías por carrera y botón "Filtrar" (orden) de la galería
  Meme.tsx              Tarjeta de un meme (con botones de editar/eliminar si es propio)
  MemeModal.tsx         Vista ampliada de un meme (imagen completa)
  MemeOwnerActions.tsx  Tres puntitos (editar) y basurero rojo (eliminar) de un meme propio
  EditMemeModal.tsx     Formulario para cambiar la descripción de un meme propio
  DeleteMemeModal.tsx   Confirmación antes de eliminar un meme propio
  Comments.tsx          Lista de comentarios y formulario para comentar (con reportar y moderar)
  ReportModal.tsx       Formulario para reportar un meme o un comentario (se dibuja en un portal sobre el <body>)
  ModerationReasonModal.tsx  Confirmación con motivo obligatorio para eliminar por moderación
  MemeAdminMenu.tsx     Engranaje de admin: limitar/permitir comentarios y eliminar un meme
  UserAvatar.tsx        Círculo con la foto de un usuario (o su inicial) para los comentarios
  UploadMemeModal.tsx   Formulario para subir un meme
  DepartmentSelect.tsx  Selector desplegable de carrera (formulario de registro)
  PodiumStack.tsx       Un puesto del podio (pila de tarjetas si hay empate)
  PodiumGroupModal.tsx  Ventana con todos los memes empatados en un puesto
context/
  auth.ts               Hook useAuth() (usuario, foto, rol y acciones de sesión); lee del store de sesión
  AuthProvider.tsx      Arranca una vez la restauración de la sesión al abrir o recargar el sitio
stores/                 Estado global con Zustand
  authStore.ts          Store de la sesión: usuario, foto, rol, login/registro/logout y restauración
  memeStore.ts          Store de la galería: memes, carreras elegidas, orden y reacciones del usuario
  adminStore.ts         Store de las alertas de moderación: cuántos posts, comentarios y usuarios están en alerta y el umbral (que define el backend)
hooks/
  useReactions.ts       Lógica de like/dislike compartida por Home, ProfilePage y PodiumPage
  useUnderReview.ts     Ids de mi contenido con reportes pendientes (para bloquear editar/eliminar)
  useSessionExpired.ts  Cierra la sesión y lleva al login cuando el backend responde 401 (para componentes sueltos)
services/
  auth.ts               Llamadas de login, registro, logout y foto de la sesión
  meme.ts               Llamadas para listar, ver el podio, subir, editar y eliminar memes
  comment.ts            Llamadas para listar y crear comentarios
  reaction.ts           Llamadas para poner, quitar y consultar likes/dislikes
  user.ts               Llamadas para ver perfiles, listar memes de un usuario y editar el propio
  report.ts             Llamadas para reportar memes y comentarios, y para consultar mi contenido en revisión
  admin.ts              Llamadas de moderación (solo admins), incluido el número de alertas
  interceptors.ts       Interceptor global de axios: un 403 "banned" en cualquier petición cierra la sesión local y muestra el aviso
utils/
  image.ts              Validación de imágenes (tipo y tamaño)
  time.ts               Tiempo relativo ("Hace 5m") para los comentarios
  reports.ts            Mensajes y detección del error "reportes pendientes" (409) del backend
types/                  Tipos de TypeScript
```

- **Invitados:** ven la galería, los comentarios, el podio y los perfiles, y un botón "Iniciar sesión". Si tocan el botón `+` para subir un meme, los lleva al login (y aunque lo intentaran por otro lado, el backend responde `401`). En un meme, en lugar del cuadro para escribir ven un enlace "Inicia sesión para comentar", y si tocan like o dislike los lleva al login.
- **Usuarios con sesión:** ven su nombre, su foto, "Cerrar sesión" y el botón `+`, y pueden comentar y dar like/dislike al abrir un meme o desde la tarjeta (el botón activo se muestra relleno). La sesión se recuerda al recargar la página (se guarda el nombre y el token CSRF en `localStorage`; la sesión real vive en la cookie) y se valida con el backend al abrir el sitio. La foto no se guarda en el navegador: se pide al backend en cada inicio o restauración de sesión.
- **Galería:** columnas tipo Pinterest que se adaptan al ancho de la pantalla (columnas de ~18rem: 1 en celular, 4 en un notebook, 6 o más en un monitor ultrawide; el ancho máximo de la página es 2000 px, en `Home.tsx`), cada imagen con su proporción natural. Las imágenes muy largas se recortan a 800 px de alto en la tarjeta (`Meme.tsx`) y se ven completas al abrir el meme.
- **Categorías y orden:** bajo el header hay un chip por carrera (ASTRO, DCC, DFI, GEOFI, GEO, DIC, DIMIN, DIE, IND, DIM, DIMEC, IQBM; el nombre completo sale al dejar el mouse encima). Cada chip se activa/desactiva al tocarlo y se pueden combinar varias (sin ninguna activa se ven todos los memes); se filtra por la carrera del **autor** del meme. El botón "Filtrar" alterna entre más nuevos primero (flecha hacia abajo) y más antiguos primero (flecha hacia arriba). El filtro y el orden los aplica el backend, y los textos cortos están en `DEPARTMENT_SHORT_NAMES` (`types/departments.ts`). Los usuarios antiguos con carrera "Sin especificar" solo aparecen sin filtro.
- **Podio:** el ícono de la copa del header lleva a `/podio`. Muestra los 3 puestos de la semana como un podio (1.º al centro y más arriba). Un puesto con un solo meme abre el meme directo; con empate se muestra como una pila de tarjetas que abre una ventana con todos los empatados. Si el usuario reacciona a algo, el podio se vuelve a pedir al cerrar las ventanas (para no reordenar las tarjetas mientras mira un meme).
- **Perfil (`/u/:username`):** muestra la foto (o la inicial del nombre), la carrera, la descripción y la cantidad de publicaciones. Las publicaciones usan el mismo formato de columnas que la galería, así que memes de distinto tamaño no dejan huecos. Por defecto se ven las últimas 3; el botón **"Mostrar todas (N)"** carga el resto (`GET /api/users/:username/memes`) y **"Mostrar menos"** vuelve a las últimas 3. El botón **"Reportar usuario"** del perfil ajeno abre el mismo formulario que los reportes de publicaciones y comentarios (un invitado va al login). Si la cuenta está baneada, el perfil muestra la etiqueta "Cuenta baneada" y el botón queda como "Usuario baneado". Los **admins** no ven "Reportar usuario": ven **"Banear usuario"** (pide un motivo) o, si ya está baneado, **"Desbanear usuario"**. El perfil no muestra contador de reportes: ese dato es solo para admins.
- **Perfil propio:** además aparece **"Editar perfil"**, donde se cambian la foto (con vista previa, "Cambiar foto" y "Quitar foto"), el nombre a mostrar y la descripción. Al guardar, la foto del header se actualiza al instante. Cada publicación propia muestra los **tres puntitos** (menú con "Editar", que abre `EditMemeModal`) y el **basurero rojo** (abre `DeleteMemeModal`, que pide confirmación). Estos botones solo se renderizan en el perfil propio: `Meme` los muestra únicamente si la página le pasa `onEdit` y `onDelete`, y la galería y los perfiles ajenos no lo hacen. Editar cambia solo la descripción; para cambiar la imagen hay que eliminar el meme y subir otro. Si un meme propio tiene reportes pendientes, muestra la marca **"En revisión"** y los botones de editar y eliminar quedan deshabilitados (con un tooltip que explica por qué) hasta que un admin resuelva los reportes; lo mismo pasa con "Editar" y "Eliminar" en los comentarios propios (`useUnderReview`, `utils/reports.ts`).
- **Foto de perfil en toda la app:** aparece en el header (`AuthContext` expone `avatar` y `setAvatar`), en el perfil y en cada comentario (`UserAvatar`). Sin foto se muestra la inicial del nombre (o el ícono por defecto en el header).
- **Likes y dislikes en cualquier página:** cualquier página que muestre memes (hoy la galería, el perfil y el podio) usa el hook `useReactions` y le pasa `reaction` y `onReact` a `<Meme>` y `<MemeModal>`. La página solo decide cómo actualizar los totales en su propio estado; el resto (cargar mis reacciones, alternar, redirigir invitados, sesión expirada) lo hace el hook. Al abrir un meme, la página guarda solo su `id` para que el modal siempre muestre los datos actualizados.
- **Reportar y moderar:** en cada meme ajeno (tarjeta y vista ampliada) y en cada comentario ajeno hay un botón de reportar que abre `ReportModal` (motivo + "¿Cuál?" si es "Otro"). Un invitado que lo toca va al login; no aparece en lo propio. Los **admins** no ven el botón de reportar: en su lugar ven un **engranaje** (siempre visible en la esquina de cada tarjeta, en la cabecera del meme ampliado y en cada comentario) con las acciones de moderación, y un botón **"Reportes"** en el header que lleva a `/admin/reportes`. Esa vista tiene tres pestañas con el mismo formato: **Posts**, **Comentarios** y **Usuarios** (reportes agrupados por contenido o por usuario, con motivos, detalle de cada reporte y las acciones descartar / eliminar / limitar comentarios / banear, en vista "Pendientes" o "Resueltos"; un usuario ya baneado se ve en "Resueltos" con la opción de desbanear). La ruta espera a que el backend confirme el rol (`AdminRoute`) antes de decidir si redirige, y la vista no muestra la barra de carreras. Las listas van de más a menos reportes y cada tarjeta muestra su cantidad; lo que está **en alerta** (`inAlert`, calculado por el backend: 5 o más reportes pendientes) lleva una etiqueta roja, y se enciende una **marca roja con el total en alerta** sobre el botón "Reportes" del header y otra en la pestaña correspondiente. El frontend no tiene el umbral escrito: lo recibe de `GET /api/admin/reports/alerts`. Se consulta al abrir la página y cada minuto, y se actualiza al resolver algo (estado en `stores/adminStore.ts`). Cuando los comentarios de un meme están limitados, el cuadro para escribir se reemplaza por un aviso y desaparece "Responder". Los modales de reporte y moderación usan un portal (`createPortal`) porque las tarjetas de la galería tienen `transform` y `overflow-hidden`, que recortarían un modal `fixed`.
- **Cuentas baneadas:** al iniciar sesión con una cuenta baneada, el formulario muestra "Esta cuenta fue baneada" (no se crea sesión). Si el baneo ocurre con la sesión abierta, la siguiente petición recibe `403 banned` y un interceptor global de axios (`services/interceptors.ts`, instalado en `main.tsx`) cierra la sesión local y muestra `BannedNotice` arriba de toda la app hasta que el usuario lo cierra. El login queda fuera del interceptor porque ya muestra su propio mensaje.
- **Formulario de subida:** vista previa de la imagen y validación de formato y tamaño antes de enviar. Si el backend rechaza algo, se muestra el motivo.

### Cambiar el límite de tamaño

El límite de 2 MB (memes y fotos de perfil) está en dos lugares que deben coincidir:

- `backend/src/utils/upload.ts` → `MAX_IMAGE_SIZE` (el que realmente se aplica)
- `frontend/src/utils/image.ts` → `MAX_IMAGE_BYTES` (solo para avisar antes de subir)

## Producción

Para que el backend sirva también el frontend:

```bash
cd backend
npm run build:ui    # compila el frontend y copia frontend/dist a backend/dist
npm run build       # compila el backend a backend/out
npm start
```

Todo queda en `http://localhost:3001`. Las rutas del frontend (como `/login` o `/podio`) funcionan al recargar la página.

## Pruebas

```bash
cd backend
npm run dev:test    # usa MONGODB_DBNAME_TEST y habilita /api/testing/reset
```

`POST /api/testing/reset` vacía los memes, comentarios, reacciones, reportes, bitácora de moderación y usuarios de la base de pruebas. Solo existe con `NODE_ENV=test`.
