# Cabo_Verde

CC5003 - Aplicaciones Web Reactivas

Sitio de memes estilo Pinterest: cualquiera puede ver los memes y sus comentarios, pero solo los usuarios con sesión pueden subir un meme (una imagen + una descripción), comentar o dar like/dislike.

## Estructura

```
Cabo_Verde/
├── backend/    API REST (Node + Express + TypeScript + MongoDB)
├── frontend/   Aplicación web (React + Vite + TypeScript + Tailwind)
└── db.json     (obsoleto) datos del antiguo json-server, ya no se usa
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
cp env.example .env     # y ajustar los valores si hace falta
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
  memes.ts              Listar memes y subir uno nuevo
  comments.ts           Listar y crear comentarios de un meme
  reactions.ts          Poner y quitar like/dislike de un meme
  users.ts              Registro de usuarios
  login.ts              Login, sesión actual y logout
  testing.ts            Reinicio de la BD (solo con NODE_ENV=test)
models/
  memes.ts              Esquema del meme
  comment.ts            Esquema del comentario
  reaction.ts           Esquema de la reacción (like/dislike) y conteo de totales
  user.ts               Esquema del usuario
utils/
  upload.ts             Subida y validación de imágenes
  middleware.ts         Autenticación, logger y manejo de errores
  config.ts             Lectura del .env
```

### Endpoints

| Método | Ruta | Sesión | Descripción |
|---|---|---|---|
| GET | `/api/memes` | No | Lista los memes, del más nuevo al más viejo, con sus totales `likes` y `dislikes` |
| GET | `/api/memes/:id` | No | Un meme (con `likes` y `dislikes`) |
| POST | `/api/memes` | **Sí** | Sube un meme (`multipart/form-data`: `content` e `image`) |
| GET | `/api/memes/:id/comments` | No | Lista los comentarios de un meme, del más nuevo al más viejo |
| POST | `/api/memes/:id/comments` | **Sí** | Comenta un meme (JSON: `content`, 1 a 300 caracteres) |
| PUT | `/api/memes/:id/reaction` | **Sí** | Pone o cambia tu reacción (JSON: `type` = `like` o `dislike`) |
| DELETE | `/api/memes/:id/reaction` | **Sí** | Quita tu reacción |
| GET | `/api/memes/reactions/mine` | **Sí** | Tus reacciones: `{ "<idDelMeme>": "like" \| "dislike" }` |
| POST | `/api/users` | No | Crea un usuario (`username`, `email`, `password`) |
| GET | `/api/users/:username` | No | Perfil público: datos, cantidad de memes y últimos 3 memes (con `likes` y `dislikes`) |
| PATCH | `/api/users/me` | **Sí** | Edita tu nombre a mostrar y descripción (JSON: `displayName`, `description`) |
| POST | `/api/login` | No | Inicia sesión |
| GET | `/api/login/me` | Sí | Datos del usuario de la sesión |
| POST | `/api/login/logout` | No | Cierra la sesión |

En `backend/requests.rest` hay ejemplos de todas las peticiones (extensión REST Client de VS Code).

### Sesiones

1. `POST /api/login` valida usuario y contraseña (guardada con `bcrypt`) y entrega un JWT dentro de una **cookie `httpOnly`**, que el navegador envía solo y que el JavaScript de la página no puede leer. Dura 1 hora.
2. Junto con el token se genera un **token CSRF**, que llega en el body y en el header `X-CSRF-Token` de la respuesta.
3. Las rutas protegidas (`withUser` en `middleware.ts`) exigen la cookie **y** que el header `X-CSRF-Token` coincida con el del token. Sin sesión responden `401`.

### Likes y dislikes

Cada usuario tiene **como máximo una reacción por meme** (like o dislike), garantizado por un índice único `(meme, usuario)` en MongoDB. Pasar de like a dislike reemplaza la reacción anterior, y repetir la misma la quita. `PUT` y `DELETE` responden `{ type, likes, dislikes }` con el estado ya actualizado, y el usuario sale de la sesión, nunca del body. Los totales se calculan al listar los memes.

> **Importante:** todo endpoint que devuelva memes debe pasar por `withReactionCounts` (en `models/reaction.ts`); si no, los memes llegan sin `likes`/`dislikes` y los contadores salen vacíos. Hoy lo usan `GET /api/memes`, `GET /api/memes/:id` y el perfil (`GET /api/users/:username`).

### Subida de imágenes

Al hacer `POST /api/memes` el backend:

1. Comprueba la sesión **antes** de recibir el archivo, así un invitado no puede subir nada.
2. Acepta una sola imagen JPG, PNG, WEBP o GIF de **máximo 2 MB** (si se pasa responde `413`).
3. Verifica que el contenido real sea una imagen (no solo el tipo que declara el navegador).
4. Guarda el archivo en `backend/uploads/` con un nombre aleatorio. En MongoDB solo se guarda la URL (`/uploads/<archivo>`), así la base de datos no crece con archivos pesados.
5. Toma el autor de la sesión, no de lo que envía el cliente.

La carpeta `uploads/` no está en git: hay que respaldarla junto con la base de datos.

## Cómo funciona el frontend

Código en `frontend/src`:

```
main.tsx / App.tsx      Punto de entrada y rutas
pages/
  Home.tsx              Galería de memes (ruta /)
  LoginPage.tsx         Iniciar sesión y crear cuenta (ruta /login)
  ProfilePage.tsx       Perfil de un usuario y sus publicaciones (ruta /u/:username)
components/
  Header.tsx            Barra superior compartida por todas las páginas
  Meme.tsx              Tarjeta de un meme en la galería
  MemeModal.tsx         Vista ampliada de un meme (imagen completa)
  Comments.tsx          Lista de comentarios y formulario para comentar
  UploadMemeModal.tsx   Formulario para subir un meme
context/
  auth.ts               Contexto y hook useAuth()
  AuthProvider.tsx      Guarda y restaura la sesión del usuario
hooks/
  useReactions.ts       Lógica de like/dislike compartida por Home y ProfilePage
services/
  auth.ts               Llamadas de login, registro, logout
  meme.ts               Llamadas para listar y subir memes
  comment.ts            Llamadas para listar y crear comentarios
  reaction.ts           Llamadas para poner, quitar y consultar likes/dislikes
  user.ts               Llamadas para ver y editar perfiles
utils/
  image.ts              Validación de imágenes (tipo y tamaño)
  time.ts               Tiempo relativo ("Hace 5m") para los comentarios
types/                  Tipos de TypeScript
```

- **Invitados:** ven la galería, los comentarios y un botón "Iniciar sesión". Si tocan el botón `+` para subir un meme, los lleva al login (y aunque lo intentaran por otro lado, el backend responde `401`). En un meme, en lugar del cuadro para escribir ven un enlace "Inicia sesión para comentar", y si tocan like o dislike los lleva al login.
- **Usuarios con sesión:** ven su nombre, "Cerrar sesión" y el botón `+`, y pueden comentar y dar like/dislike al abrir un meme o desde la tarjeta de la galería (el botón activo se muestra relleno). La sesión se recuerda al recargar la página (se guarda el nombre y el token CSRF en `localStorage`; la sesión real vive en la cookie) y se valida con el backend al abrir el sitio.
- **Galería:** columnas tipo Pinterest que se adaptan al ancho de la pantalla (columnas de ~18rem: 1 en celular, 4 en un notebook, 6 o más en un monitor ultrawide; el ancho máximo de la página es 2000 px, en `Home.tsx`), cada imagen con su proporción natural. Las imágenes muy largas se recortan a 800 px de alto en la tarjeta (`Meme.tsx`) y se ven completas al abrir el meme.
- **Likes y dislikes en cualquier página:** cualquier página que muestre memes (hoy la galería y el perfil) usa el hook `useReactions` y le pasa `reaction` y `onReact` a `<Meme>` y `<MemeModal>`. La página solo decide cómo actualizar los totales en su propio estado; el resto (cargar mis reacciones, alternar, redirigir invitados, sesión expirada) lo hace el hook. Al abrir un meme, la página guarda solo su `id` para que el modal siempre muestre los contadores actualizados.
- **Formulario de subida:** vista previa de la imagen y validación de formato y tamaño antes de enviar. Si el backend rechaza algo, se muestra el motivo.

### Cambiar el límite de tamaño

El límite de 2 MB está en dos lugares que deben coincidir:

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

Todo queda en `http://localhost:3001`. Las rutas del frontend (como `/login`) funcionan al recargar la página.

## Pruebas

```bash
cd backend
npm run dev:test    # usa MONGODB_DBNAME_TEST y habilita /api/testing/reset
```

`POST /api/testing/reset` vacía los memes, comentarios, reacciones y usuarios de la base de pruebas. Solo existe con `NODE_ENV=test`.
