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
test.

Revisa `backend\.env` y confirma que `MONGODB_URI` apunta a tu MongoDB local y
que `MONGODB_DBNAME_TEST` identifica una base de datos exclusiva para pruebas.

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

**Terminal 2 — frontend**

```powershell
cd frontend
npm run dev
```

**Terminal 3 — Playwright**

```powershell
cd e2e-test
npm test
```

## Reporte de resultados

Al finalizar, Playwright genera un reporte HTML. Para abrir el último reporte:

```powershell
npx playwright show-report
```
