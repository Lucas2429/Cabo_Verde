# Pruebas E2E

Las pruebas usan Playwright para abrir la aplicación en el navegador y recorrer
flujos completos, como registro, publicación y moderación. La configuración
actual ejecuta Chromium, Firefox y WebKit contra `http://localhost:5173`.

## Requisitos

- Node.js y npm.
- MongoDB en ejecución y accesible desde el backend.
- Dependencias instaladas en `backend`, `frontend` y `e2e-test`.
- Los navegadores de Playwright instalados (solo hace falta hacerlo una vez).

## Preparar el entorno

Las pruebas deben usar una base de datos separada de cualquier base de datos con
información real. El backend usa `MONGODB_DBNAME_TEST` cuando se ejecuta en modo
test. Si todavía no tienes `backend/.env`, créalo copiando el ejemplo:

```powershell
Copy-Item backend\env.example backend\.env
```

Revisa `backend\.env` y confirma que `MONGODB_URI` apunta a tu MongoDB local y
que `MONGODB_DBNAME_TEST` identifica una base de datos exclusiva para pruebas.
No ejecutes estos tests contra producción: crean usuarios y contenido en esa
base.

Instala las dependencias de cada paquete una vez:

```powershell
cd backend
npm install
cd ..\frontend
npm install
cd ..\e2e-test
npm install
npx playwright install
```

## Ejecutar todos los tests

Deja corriendo MongoDB y abre tres terminales desde la raíz del repositorio:

**Terminal 1 — backend en modo test**

```powershell
cd backend
npm run dev:test
```

El backend queda disponible en `http://localhost:3001` y usa la base de datos
configurada en `MONGODB_DBNAME_TEST`.

**Terminal 2 — frontend**

```powershell
cd frontend
npm run dev
```

Vite sirve la aplicación en `http://localhost:5173` y reenvía las peticiones de
la API al backend.

**Terminal 3 — Playwright**

```powershell
cd e2e-test
npm test
```

Playwright ejecuta los tests secuencialmente en Chromium, Firefox y WebKit. Los
flujos crean usuarios y datos con nombres únicos; los datos quedan en la base
de pruebas.

## Ejecutar una parte de la suite

Desde `e2e-test`, puedes elegir un navegador:

```powershell
npx playwright test --project=chromium
```

O ejecutar un archivo y filtrar por el nombre del test:

```powershell
npx playwright test tests/admin_moderation.spec.ts -g "revisar y resolver el reporte de un comentario"
```

## Reporte de resultados

Al finalizar, Playwright genera un reporte HTML. Para abrir el último reporte:

```powershell
npx playwright show-report
```
