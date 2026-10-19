# Cabo_Verde

CC5003 - Aplicaciones Web Reactivas

Sitio de memes estilo Pinterest: cualquiera puede ver los memes, sus comentarios y el podio de la semana, pero solo los usuarios con sesión pueden subir un meme (una imagen + una descripción), comentar o dar like/dislike. Cada usuario tiene un perfil con su foto, su carrera y sus publicaciones, que puede editar y eliminar.

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

## Cómo funciona el backend

Código en `backend/src`:

```
app.ts                  Configuración de Express, rutas y archivos estáticos
index.ts                Arranca el servidor
controllers/
  memes.ts              Listar/filtrar memes, podio, subir, editar y eliminar un meme
  comments.ts           Listar y crear comentarios de un meme
  reactions.ts          Poner y quitar like/dislike de un meme
  users.ts              Registro, perfil público, memes de un usuario y edición del perfil propio
  login.ts              Login, sesión actual y logout
  testing.ts            Reinicio de la BD (solo con NODE_ENV=test)
models/
  memes.ts              Esquema del meme
  comment.ts            Esquema del comentario y withAuthorAvatars (foto del autor)
  reaction.ts           Esquema de la reacción (like/dislike) y conteo de totales
  user.ts               Esquema del usuario (incluye carrera y foto de perfil)
utils/
  upload.ts             Subida y validación de imágenes (memes y fotos de perfil)
  podium.ts             Arma el podio a partir de los memes de la semana
  week.ts               Calcula la semana en curso (lunes a domingo, hora de Chile)
  middleware.ts         Autenticación, logger y manejo de errores
  config.ts             Lectura del .env
```

### Endpoints

"Sesión" significa tener la cookie `token` y enviar el header `X-CSRF-Token`; sin eso el backend responde `401`.

| Método | Ruta | Sesión | Descripción |
|---|---|---|---|
| GET | `/api/memes` | No | Lista los memes con sus totales `likes` y `dislikes`. Filtros opcionales: `department` (carrera del **autor**; se puede repetir para combinar varias) y `order` (`newest` por defecto, o `oldest`) |
| GET | `/api/memes/podium` | No | Podio de la semana en curso (ver [Podio semanal](#podio-semanal)) |
| GET | `/api/memes/reactions/mine` | **Sí** | Tus reacciones: `{ "<idDelMeme>": "like" \| "dislike" }` |
| GET | `/api/memes/:id` | No | Un meme (con `likes` y `dislikes`) |
| POST | `/api/memes` | **Sí** | Sube un meme (`multipart/form-data`: `content` e `image`) |
| PATCH | `/api/memes/:id` | **Sí, solo el autor** | Cambia la descripción del meme (JSON: `content`, 1 a 300 caracteres). `403` si no es tuyo, `404` si no existe |
| DELETE | `/api/memes/:id` | **Sí, solo el autor** | Elimina el meme con sus comentarios, reacciones e imagen. Responde `204`; `403` si no es tuyo |
| GET | `/api/memes/:id/comments` | No | Lista los comentarios de un meme, del más nuevo al más viejo (con `authorAvatar`) |
| POST | `/api/memes/:id/comments` | **Sí** | Comenta un meme (JSON: `content`, 1 a 300 caracteres, y `parent` opcional para responder a otro comentario) |
| PUT | `/api/memes/:id/reaction` | **Sí** | Pone o cambia tu reacción (JSON: `type` = `like` o `dislike`) |
| DELETE | `/api/memes/:id/reaction` | **Sí** | Quita tu reacción |
| POST | `/api/users` | No | Crea un usuario (`username`, `email`, `password`; opcionales `department`, `displayName`, `description`) |
| GET | `/api/users` | No | Lista los usuarios |
| GET | `/api/users/:username` | No | Perfil público: nombre, descripción, foto, carrera, cantidad de memes y últimos 3 memes (con `likes` y `dislikes`) |
| GET | `/api/users/:username/memes` | No | Todos los memes de un usuario, del más nuevo al más viejo (con `likes` y `dislikes`) |
| PATCH | `/api/users/me` | **Sí** | Edita tu perfil: `displayName`, `description`, foto nueva (`image`, solo con `multipart/form-data`) o `removeAvatar: true` para quitarla. Acepta JSON o `multipart/form-data` |
| POST | `/api/login` | No | Inicia sesión |
| GET | `/api/login/me` | Sí | Datos del usuario de la sesión |
| POST | `/api/login/logout` | No | Cierra la sesión |
| POST | `/api/testing/reset` | No | Vacía la BD de pruebas. **Solo existe con `NODE_ENV=test`**; en otro entorno responde `404` |
| GET | `/uploads/<archivo>` | No | Sirve las imágenes subidas (memes y fotos de perfil) |

En `backend/requests.rest` hay ejemplos de las peticiones (extensión REST Client de VS Code).

### Sesiones

1. `POST /api/login` valida usuario y contraseña (guardada con `bcrypt`) y entrega un JWT dentro de una **cookie `httpOnly`**, que el navegador envía solo y que el JavaScript de la página no puede leer. Dura 1 hora.
2. Junto con el token se genera un **token CSRF**, que llega en el body y en el header `X-CSRF-Token` de la respuesta.
3. Las rutas protegidas (`withUser` en `middleware.ts`) exigen la cookie **y** que el header `X-CSRF-Token` coincida con el del token. Sin sesión responden `401`.

### Editar y eliminar solo lo propio

`PATCH` y `DELETE` de `/api/memes/:id` comparan el dueño del meme guardado en la base de datos con el usuario de la sesión (que sale del token, nunca de lo que envía el cliente). Si no coinciden responden `403`, así que ocultar los botones en el frontend es solo una comodidad: la regla la aplica el backend. Lo mismo vale para `PATCH /api/users/me`, que siempre edita al usuario de la sesión.

### Likes y dislikes

Cada usuario tiene **como máximo una reacción por meme** (like o dislike), garantizado por un índice único `(meme, usuario)` en MongoDB. Pasar de like a dislike reemplaza la reacción anterior, y repetir la misma la quita. `PUT` y `DELETE` responden `{ type, likes, dislikes }` con el estado ya actualizado, y el usuario sale de la sesión, nunca del body. Los totales se calculan al listar los memes.

> **Importante:** todo endpoint que devuelva memes debe incluir sus `likes` y `dislikes`, ya sea pasando por `withReactionCounts` (en `models/reaction.ts`) o usando `getReactionCounts` (como hace el podio); si no, los memes llegan sin ellos y los contadores salen vacíos. Hoy lo hacen `GET /api/memes`, `GET /api/memes/:id`, `GET /api/memes/podium`, `PATCH /api/memes/:id`, `GET /api/users/:username` y `GET /api/users/:username/memes`.

### Comentarios y fotos de autor

Los comentarios guardan solo el nombre del autor y su id. La foto de perfil **no se copia** en cada comentario: `withAuthorAvatars` (en `models/comment.ts`) la busca en la colección de usuarios al responder y la entrega como `authorAvatar` (`null` si no tiene). Así, si alguien cambia su foto, todos sus comentarios anteriores la muestran. Todo endpoint que devuelva comentarios debe pasar por esa función.

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

Es una SPA: React Router resuelve las rutas en el navegador y nunca se recarga la página. Rutas: `/` (galería), `/login`, `/podio` (podio de la semana) y `/u/:username` (perfil).

Código en `frontend/src`:

```
main.tsx / App.tsx      Punto de entrada y rutas
pages/
  Home.tsx              Galería de memes (ruta /)
  LoginPage.tsx         Iniciar sesión y crear cuenta (ruta /login)
  PodiumPage.tsx        Podio de la semana (ruta /podio)
  ProfilePage.tsx       Perfil de un usuario y sus publicaciones (ruta /u/:username)
components/
  Header.tsx            Barra superior compartida (podio, perfil y foto del usuario)
  CategoryBar.tsx       Categorías por carrera y botón "Filtrar" (orden) de la galería
  Meme.tsx              Tarjeta de un meme (con botones de editar/eliminar si es propio)
  MemeModal.tsx         Vista ampliada de un meme (imagen completa)
  MemeOwnerActions.tsx  Tres puntitos (editar) y basurero rojo (eliminar) de un meme propio
  EditMemeModal.tsx     Formulario para cambiar la descripción de un meme propio
  DeleteMemeModal.tsx   Confirmación antes de eliminar un meme propio
  Comments.tsx          Lista de comentarios y formulario para comentar
  UserAvatar.tsx        Círculo con la foto de un usuario (o su inicial) para los comentarios
  UploadMemeModal.tsx   Formulario para subir un meme
  DepartmentSelect.tsx  Selector desplegable de carrera (formulario de registro)
  PodiumStack.tsx       Un puesto del podio (pila de tarjetas si hay empate)
  PodiumGroupModal.tsx  Ventana con todos los memes empatados en un puesto
context/
  auth.ts               Contexto y hook useAuth() (usuario, foto y acciones de sesión)
  AuthProvider.tsx      Guarda y restaura la sesión del usuario y carga su foto
hooks/
  useReactions.ts       Lógica de like/dislike compartida por Home, ProfilePage y PodiumPage
services/
  auth.ts               Llamadas de login, registro, logout y foto de la sesión
  meme.ts               Llamadas para listar, ver el podio, subir, editar y eliminar memes
  comment.ts            Llamadas para listar y crear comentarios
  reaction.ts           Llamadas para poner, quitar y consultar likes/dislikes
  user.ts               Llamadas para ver perfiles, listar memes de un usuario y editar el propio
utils/
  image.ts              Validación de imágenes (tipo y tamaño)
  time.ts               Tiempo relativo ("Hace 5m") para los comentarios
types/                  Tipos de TypeScript
```

- **Invitados:** ven la galería, los comentarios, el podio y los perfiles, y un botón "Iniciar sesión". Si tocan el botón `+` para subir un meme, los lleva al login (y aunque lo intentaran por otro lado, el backend responde `401`). En un meme, en lugar del cuadro para escribir ven un enlace "Inicia sesión para comentar", y si tocan like o dislike los lleva al login.
- **Usuarios con sesión:** ven su nombre, su foto, "Cerrar sesión" y el botón `+`, y pueden comentar y dar like/dislike al abrir un meme o desde la tarjeta (el botón activo se muestra relleno). La sesión se recuerda al recargar la página (se guarda el nombre y el token CSRF en `localStorage`; la sesión real vive en la cookie) y se valida con el backend al abrir el sitio. La foto no se guarda en el navegador: se pide al backend en cada inicio o restauración de sesión.
- **Galería:** columnas tipo Pinterest que se adaptan al ancho de la pantalla (columnas de ~18rem: 1 en celular, 4 en un notebook, 6 o más en un monitor ultrawide; el ancho máximo de la página es 2000 px, en `Home.tsx`), cada imagen con su proporción natural. Las imágenes muy largas se recortan a 800 px de alto en la tarjeta (`Meme.tsx`) y se ven completas al abrir el meme.
- **Categorías y orden:** bajo el header hay un chip por carrera (ASTRO, DCC, DFI, GEOFI, GEO, DIC, DIMIN, DIE, IND, DIM, DIMEC, IQBM; el nombre completo sale al dejar el mouse encima). Cada chip se activa/desactiva al tocarlo y se pueden combinar varias (sin ninguna activa se ven todos los memes); se filtra por la carrera del **autor** del meme. El botón "Filtrar" alterna entre más nuevos primero (flecha hacia abajo) y más antiguos primero (flecha hacia arriba). El filtro y el orden los aplica el backend, y los textos cortos están en `DEPARTMENT_SHORT_NAMES` (`types/departments.ts`). Los usuarios antiguos con carrera "Sin especificar" solo aparecen sin filtro.
- **Podio:** el ícono de la copa del header lleva a `/podio`. Muestra los 3 puestos de la semana como un podio (1.º al centro y más arriba). Un puesto con un solo meme abre el meme directo; con empate se muestra como una pila de tarjetas que abre una ventana con todos los empatados. Si el usuario reacciona a algo, el podio se vuelve a pedir al cerrar las ventanas (para no reordenar las tarjetas mientras mira un meme).
- **Perfil (`/u/:username`):** muestra la foto (o la inicial del nombre), la carrera, la descripción y la cantidad de publicaciones. Las publicaciones usan el mismo formato de columnas que la galería, así que memes de distinto tamaño no dejan huecos. Por defecto se ven las últimas 3; el botón **"Mostrar todas (N)"** carga el resto (`GET /api/users/:username/memes`) y **"Mostrar menos"** vuelve a las últimas 3. Los "reportes" del perfil son solo frontend: no existen en el backend y se reinician al recargar.
- **Perfil propio:** además aparece **"Editar perfil"**, donde se cambian la foto (con vista previa, "Cambiar foto" y "Quitar foto"), el nombre a mostrar y la descripción. Al guardar, la foto del header se actualiza al instante. Cada publicación propia muestra los **tres puntitos** (menú con "Editar", que abre `EditMemeModal`) y el **basurero rojo** (abre `DeleteMemeModal`, que pide confirmación). Estos botones solo se renderizan en el perfil propio: `Meme` los muestra únicamente si la página le pasa `onEdit` y `onDelete`, y la galería y los perfiles ajenos no lo hacen. Editar cambia solo la descripción; para cambiar la imagen hay que eliminar el meme y subir otro.
- **Foto de perfil en toda la app:** aparece en el header (`AuthContext` expone `avatar` y `setAvatar`), en el perfil y en cada comentario (`UserAvatar`). Sin foto se muestra la inicial del nombre (o el ícono por defecto en el header).
- **Likes y dislikes en cualquier página:** cualquier página que muestre memes (hoy la galería, el perfil y el podio) usa el hook `useReactions` y le pasa `reaction` y `onReact` a `<Meme>` y `<MemeModal>`. La página solo decide cómo actualizar los totales en su propio estado; el resto (cargar mis reacciones, alternar, redirigir invitados, sesión expirada) lo hace el hook. Al abrir un meme, la página guarda solo su `id` para que el modal siempre muestre los datos actualizados.
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

`POST /api/testing/reset` vacía los memes, comentarios, reacciones y usuarios de la base de pruebas. Solo existe con `NODE_ENV=test`.
