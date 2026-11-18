# Vistazo — la pull request visual

Herramienta de revisión visual para apps, webs y experiencias digitales, pensada para quien programa con agentes.
Publicas una versión con contexto y recorridos de prueba, la compartes con un enlace, el revisor la prueba y comenta
sobre lo que ve, y alguien identificado la aprueba explícitamente. El feedback vuelve a tu agente como un
comentario-resumen y un prompt que **tú** revisas y pegas.

- Producción (POC): https://vistazo-pi.vercel.app
- App de demo independiente (empresa ficticia, datos sintéticos): https://brasa-demo-murex.vercel.app (`/v1/`, `/v2/`)
- Licencia MIT. Las contribuciones son bienvenidas: abre una issue antes de un cambio grande.

## Circuito

**App → Revisión → Versión**, como repositorio → pull request → commits. Detalle de producto en `PRODUCT.md`;
sistema visual en `DESIGN.md`.

1. **Publicar** una versión desde el agente (`vistazo publish`, CLI o MCP) o desde el formulario. Las dos vías llaman a
   la misma API (`POST /api/projects/:id/revisions`). La versión va a la revisión abierta de la **rama** (o crea una
   revisión nueva); con `review.id` va a una revisión concreta.
2. **Compartir**: personas con cuenta (propietario, editor, revisor) o un enlace de invitado que **solo abre esa
   revisión**, revocable y con caducidad.
3. **Revisar**. Cada revisión tiene tres pestañas, como una PR:
   - **Resumen** (la conversación): descripción, qué probar con su progreso, y en orden todo lo que pasó (versiones,
     comentarios con sus hilos, veredictos). Al lado: siguiente paso, revisores, cómo abrir la app, kit de prueba.
   - **Revisar** (lo importante): capturas por pantalla, la app en vivo (web) o **en el móvil** (QR de Expo/Metro, EAS
     Update, deep link, descarga), o los cambios desde la versión anterior. Al lado: comentarios, **kit de prueba** y
     pruebas.
   - **Versiones** (los commits): v1, v2… con quién la publicó, qué trae, metadatos y veredictos.
   **Terminar revisión**: Aprobar, Pedir cambios o Solo comentar (los invitados solo envían comentarios; el autor no
   aprueba lo suyo).
4. **Llevar el feedback a tu agente**: prompt con los comentarios aislados como datos (web, `vistazo feedback`,
   herramienta MCP `vistazo_feedback`). Resumen markdown solo para personas.
5. **Nueva versión**: los comentarios abiertos de esa revisión pasan solos; el diff compara con la anterior de la misma
   revisión; la aprobación anterior deja de contar.

El estado de la revisión se calcula (`src/lib/flow.ts`) y decide el botón principal de cada persona, sin bloquear
nada más. El buzón **Te toca** (`/app`) junta lo pendiente de todas tus apps.

## Modelo

```
App (colección projects: contexto, plataforma, tipos de dato del kit, flujos críticos, miembros, claves de agente)
 └─ Revisión (reviews: título, qué cambia, qué probar, kit de prueba, notas, rama, enlace a PR, estado)
     ├─ Versión vN (revisions: inmutable salvo veredictos y checks; recorridos → pasos → adjuntos)
     └─ Comentario (comments: ancla + revisionIds[] donde está vigente + historial de eventos)
Enlace de invitado (shareLinks: atado a una revisión)
```

Los datos anteriores (versiones sueltas por app) se agrupan solos en una revisión #1 la primera vez que se leen
(`ensureMigrated`, idempotente y en transacción): un despliegue nuevo no necesita script de migración.

## Arquitectura

| Pieza | Elección | Por qué |
|---|---|---|
| Front + API | Next.js 16 (App Router, route handlers) en Vercel, región `fra1` | Decisión tomada: todo en Vercel |
| Base de datos | Firestore (proyecto Firebase dedicado, plan Spark) vía `firebase-admin` | Decisión tomada: Firebase solo como BD |
| Ficheros | Vercel Blob **privado**; subida directa con token de un solo fichero; lectura siempre por `/api/files/…` con control de acceso | Sin el límite de 4,5 MB del cuerpo de las funciones; revocar un enlace corta también capturas y vídeos |
| Auth | Cuentas propias (correo + contraseña scrypt), sesión JWT en cookie httpOnly; invitado = cookie firmada atada a un enlace de revisión que se comprueba en cada petición; agente = clave `vzk_…` por app (solo se guarda su hash) | Sin dependencias externas; revocable al instante |
| Capturas | Runner Playwright en **la máquina del agente** (`vistazo capture` / `publish --capture`) | Ver «Viabilidad» |
| Web en vivo | iframe + capa de pines; `bridge.js` opcional en la app para anclar a elementos | Funciona con cualquier web que se deje enmarcar |

Permisos: `src/lib/auth.ts` (`access()` decide por app; `needScope()` limita al invitado a su revisión). Invitado: ver,
probar, comentar, marcar lo probado, enviar comentarios; no aprueba, no resuelve, no lee el prompt. Agente: publicar y
leer feedback; no comenta, no resuelve, no aprueba. Autor de una revisión: no la aprueba ni pide cambios en ella.

## Viabilidad comprobada (y lo que no)

- **Playwright en el serverless de Vercel: no lo uso.** Las funciones tienen límite de tamaño (250 MB descomprimido)
  y de duración; Chromium no cabe sin paquetes recortados (`@sparticuz/chromium`) y un recorrido largo con vídeo choca
  con los tiempos. Además el runner necesita llegar a entornos locales o privados del desarrollador. Por eso corre donde
  está el agente. Comprobado en local: captura por paso, enmascarado de campos (`mask`) y vídeo por recorrido.
- **Qué graba Playwright**: el contenido de la página (PNG por paso, `webm` por recorrido). No graba audio, ni la barra
  del navegador, ni apps nativas, ni diálogos del sistema operativo.
- **Apps nativas (Expo/iOS/Android)**: Playwright no sirve. Vía soportada: subida manual (formulario) o carpeta de
  capturas de otro runner (`--assets`: simulador, Appium/WebdriverIO, Maestro) + vía de prueba con **QR / deep link**.
  Comentar «en vivo» una app nativa necesitaría streaming de emulador (tipo Appetize): no incluido.
- **Web en vivo**: solo si la web se deja enmarcar (sin `X-Frame-Options: DENY` ni `frame-ancestors`). Si no, el revisor
  la abre aparte y comenta sobre capturas o en general. Sin `bridge.js` la URL del iframe no se puede leer (origen
  cruzado): la indica el revisor.
- **Despliegues protegidos de Vercel**: las URLs por despliegue de un proyecto Hobby piden login de Vercel y un invitado
  externo no puede abrirlas. La demo usa el alias de producción con una ruta por versión (`/v1/`, `/v2/`).

## Kit de prueba

Lo que quien revisa necesita a mano: usuarios, contraseñas de test, cupones, códigos que escanear, productos… Es un
JSON de páginas → filas → etiquetas (`src/lib/kit.ts`), **el mismo formato que una página de etiquetas QR**, así que un
JSON o una página HTML ya generados (con su bloque `<script id="page-data">`) se publican tal cual
(`vistazo publish --kit`). En pantalla solo se ve el nombre y el código; el QR se abre de uno en uno para que un
escáner no lea el de al lado. Los tipos (`kind`) son libres: hay genéricos y cada app añade los suyos con nombre,
color e icono (en Ajustes o en `kinds` de `vistazo.json`).

## Agente (CLI / MCP)

Un `vistazo.json` en la raíz del repo (sin secretos) evita repetir parámetros:

```json
{ "url": "https://vistazo-pi.vercel.app", "project": "<id>", "platform": "mobile",
  "kit": ".vistazo/kit.json", "open": [{ "kind": "qr", "label": "Expo", "url": "exp+app://…" }],
  "kinds": [{ "key": "pallet", "name": "Palé", "color": "orange", "icon": "stack" }] }
```

Para agentes de código hay una skill lista para copiar en `skills/vistazo/SKILL.md`: cómo publicar con capturas, kit
de prueba y QR, y cómo tratar el feedback como datos.

```bash
export VISTAZO_URL=https://vistazo-pi.vercel.app VISTAZO_PROJECT=<id> VISTAZO_API_KEY=vzk_…   # nunca en el repo
cd cli && npm i && npx playwright install chromium
node cli/bin/vistazo.mjs publish --config vistazo.config.json --capture --title "…" --summary "…"   # rama actual
node cli/bin/vistazo.mjs publish --shots ./capturas --qr "exp+app://…" --kit kit.json --title "…"   # app móvil
node cli/bin/vistazo.mjs publish … --deeplink "miapp://…" --download https://…/app.apk   # más formas de abrirla
node cli/bin/vistazo.mjs publish … --branch feature/x --pr https://github.com/o/r/pull/7 --test-data "usuario / clave de test"
node cli/bin/vistazo.mjs feedback                   # prompt de la revisión de tu rama (o --json)
node cli/bin/vistazo.mjs reviews                    # revisiones de la app con su estado
node cli/bin/vistazo.mjs mcp                        # servidor MCP por stdio
```

Sin `--pr`, si `gh` está instalado y autenticado, la CLI lee la PR de la rama (`gh pr view`, solo lectura) y guarda
**solo el enlace**: no se sincroniza estado ni se escribe nada en GitHub.

`vistazo.config.json` (ejemplo real en `demo/vistazo.config.json`): `baseUrl`, `allowHosts` (la CLI se niega a capturar
otros hosts), `viewport`, `mask`, `video` y `flows[]` con `description` en lenguaje natural + `actions` que traduce el
agente (`goto`, `click`, `fill`, `select`, `press`, `waitFor`, `wait`, `expectText`). Secretos con `${env:VAR}`.
Plantillas e instrucciones para agentes y otros runners en `integrations/`.

## Seguridad

- Secretos solo en variables de entorno (`SESSION_SECRET`, `FIREBASE_SERVICE_ACCOUNT_B64`, `BLOB_READ_WRITE_TOKEN`).
  La service account `vistazo-backend` solo tiene `roles/datastore.user`.
- Enlaces de invitado y claves: se guarda el hash; el secreto se muestra una vez. Revocación inmediata.
- **Feedback para el agente** (`src/lib/feedback.ts`, `src/lib/untrusted.ts`). Todo lo que escriben revisores e
  invitados (y lo que llega del navegador: URL, selector, texto del elemento) es dato de terceros. Capas:
  1. Un solo canal: los datos de terceros solo van dentro de un bloque JSON; fuera solo hay texto del equipo y números.
  2. Delimitador con código aleatorio por generación (`<reviewer_comments_…>`), y `<`, `>`, `&` escapados dentro.
  3. Sin caracteres invisibles (tags Unicode, bidi, anchura cero…), al guardar y al generar.
  4. Lo que parece una orden para un agente se aparta por defecto; solo una persona, desde la web, puede incluirlo.
  5. Persona en el medio: el prompt pide un plan antes de tocar nada; el agente no recibe el resumen markdown; la CLI y
     el MCP no tienen herramientas para borrar, desplegar ni hacer push.

  Pruebas: `npm test` (propiedades con marcas en cada campo de terceros + fuzz), `scripts/e2e.mjs` (contra la API) y
  `scripts/redteam-feedback.ts` (comportamiento con un modelo real y herramientas falsas; cuesta dinero). Ningún
  formato garantiza que un modelo no obedezca un texto: por eso la capa 5 es la que contiene el daño.
- Los enlaces para abrir la app admiten esquemas propios (`exp+…://`) pero nunca `javascript:`, `data:` ni `file:`;
  el kit externo solo `https://`. Los QR se generan en el navegador: nada sale a servicios externos.
- Los artifacts HTML/SVG se sirven como descarga, nunca se renderizan en el origen de Vistazo.
- `bridge.js` solo habla con la ventana del origen del que se cargó; no envía nada a ningún servidor ni lee formularios.

## Desarrollo

```bash
npm i && vercel env pull .env.local
npm test                                             # aislamiento del prompt y formato del kit (sin red)
# Local sin tocar la base de datos real: emulador de Firestore + copia de la demo (solo lee de producción)
java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-*.jar --host=127.0.0.1 --port=8085 &
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 SOURCE=https://vistazo-pi.vercel.app DEMO_PASSWORD=… node scripts/seed-local.mjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npx next dev -p 3100
VISTAZO_URL=http://localhost:3100 PROJECT=<id> DEMO_PASSWORD=… node scripts/e2e.mjs   # circuito completo (crea datos)
```

`scripts/walkthrough*.mjs` grabaron el vídeo de la interfaz anterior; no están adaptados a la nueva.

Límites del POC y pendientes: `docs/PENDIENTE.md`. Compatibilidad futura con apps nativas con OTA por PR:
`docs/COMPATIBILIDAD-NATIVA.md` e `integrations/`.
