# Cabo_Verde

CC5003 - Aplicaciones Web Reactivas

Sitio de memes estilo Pinterest: cualquiera puede ver los memes, pero solo los usuarios con sesión pueden subir uno (una imagen + una descripción).

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
  users.ts              Registro de usuarios
  login.ts              Login, sesión actual y logout
  testing.ts            Reinicio de la BD (solo con NODE_ENV=test)
models/
  memes.ts              Esquema del meme
  user.ts               Esquema del usuario
utils/
  upload.ts             Subida y validación de imágenes
  middleware.ts         Autenticación, logger y manejo de errores
  config.ts             Lectura del .env
```

### Endpoints

| Método | Ruta | Sesión | Descripción |
|---|---|---|---|
| GET | `/api/memes` | No | Lista los memes, del más nuevo al más viejo |
| GET | `/api/memes/:id` | No | Un meme |
| POST | `/api/memes` | **Sí** | Sube un meme (`multipart/form-data`: `content` e `image`) |
| POST | `/api/users` | No | Crea un usuario (`username`, `email`, `password`) |
| POST | `/api/login` | No | Inicia sesión |
| GET | `/api/login/me` | Sí | Datos del usuario de la sesión |
| POST | `/api/login/logout` | No | Cierra la sesión |

En `backend/requests.rest` hay ejemplos de todas las peticiones (extensión REST Client de VS Code).

### Sesiones

1. `POST /api/login` valida usuario y contraseña (guardada con `bcrypt`) y entrega un JWT dentro de una **cookie `httpOnly`**, que el navegador envía solo y que el JavaScript de la página no puede leer. Dura 1 hora.
2. Junto con el token se genera un **token CSRF**, que llega en el body y en el header `X-CSRF-Token` de la respuesta.
3. Las rutas protegidas (`withUser` en `middleware.ts`) exigen la cookie **y** que el header `X-CSRF-Token` coincida con el del token. Sin sesión responden `401`.

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
components/
  Meme.tsx              Tarjeta de un meme en la galería
  MemeModal.tsx         Vista ampliada de un meme (imagen completa)
  UploadMemeModal.tsx   Formulario para subir un meme
context/
  auth.ts               Contexto y hook useAuth()
  AuthProvider.tsx      Guarda y restaura la sesión del usuario
services/
  auth.ts               Llamadas de login, registro, logout
  meme.ts               Llamadas para listar y subir memes
utils/image.ts          Validación de imágenes (tipo y tamaño)
types/                  Tipos de TypeScript
```

- **Invitados:** ven la galería y un botón "Iniciar sesión". Si tocan el botón `+` para subir un meme, los lleva al login (y aunque lo intentaran por otro lado, el backend responde `401`).
- **Usuarios con sesión:** ven su nombre, "Cerrar sesión" y el botón `+`. La sesión se recuerda al recargar la página (se guarda el nombre y el token CSRF en `localStorage`; la sesión real vive en la cookie) y se valida con el backend al abrir el sitio.
- **Galería:** columnas tipo Pinterest que se adaptan al ancho de la pantalla (columnas de ~18rem: 1 en celular, 4 en un notebook, 6 o más en un monitor ultrawide; el ancho máximo de la página es 2000 px, en `Home.tsx`), cada imagen con su proporción natural. Las imágenes muy largas se recortan a 800 px de alto en la tarjeta (`Meme.tsx`) y se ven completas al abrir el meme.
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

`POST /api/testing/reset` vacía los memes y usuarios de la base de pruebas. Solo existe con `NODE_ENV=test`.
