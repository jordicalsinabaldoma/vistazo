# Vistazo — la pull request visual

Herramienta de revisión visual para apps, webs y experiencias digitales, pensada para quien programa con agentes.
Publicas una versión con contexto y recorridos de prueba, la compartes con un enlace, el revisor la prueba y comenta
sobre lo que ve, y alguien identificado la aprueba explícitamente. El feedback vuelve a tu agente como un
comentario-resumen y un prompt que **tú** revisas y pegas.

- Producción (POC): https://vistazo-pi.vercel.app
- App de demo independiente (empresa ficticia, datos sintéticos): https://brasa-demo-murex.vercel.app (`/v1/`, `/v2/`)

## Circuito

1. **Publicar** una revisión — desde el agente (`vistazo publish`, CLI o MCP) o desde el formulario. Las dos vías llaman
   a la misma API (`POST /api/projects/:id/revisions`) y producen exactamente el mismo objeto.
2. **Compartir** — miembros identificados (propietario, editor, revisor) o enlace de invitado revocable, limitado a un proyecto.
3. **Revisar** — comentarios anclados a una captura (posición, y segundo en vídeos), a un paso, a la web en vivo
   (posición o, con `bridge.js`, elemento con selector) o generales. Checklist de flujos críticos por proyecto.
4. **Responder / resolver** (equipo autor) ≠ **aprobar** (usuario identificado, acto explícito). La aprobación es visual:
   no hace merge ni deploy.
5. **Nueva revisión** — historial intacto; los comentarios abiertos se arrastran solos; diff visual con la anterior.
6. **Feedback para el agente** — resumen + prompt + JSON (web, `vistazo feedback`, herramienta MCP `vistazo_feedback`).

## Modelo

```
Proyecto (contexto, checklist, miembros, enlaces de invitado, claves de agente)
 └─ Revisión vN (inmutable salvo aprobaciones/checks: título, contexto, enlace en vivo, vías de prueba, meta)
     └─ Recorrido (clave estable + descripción en lenguaje natural)
         └─ Paso (clave estable, notas, URL) → adjuntos (imagen, vídeo, artifact)
Comentario (cuelga del PROYECTO): ancla + revisionIds[] donde está vigente + historial de eventos
```

Cambio respecto a la propuesta inicial: los comentarios no se copian a cada versión. Viven en el proyecto con la lista
de revisiones donde están vigentes (`revisionIds`). Publicar añade la nueva revisión a todos los abiertos («arrastre»),
así no hay duplicados, el historial de cada comentario es uno solo y las revisiones viejas siguen mostrando lo que
tenían. Las **claves estables** de recorrido y paso permiten emparejar capturas entre versiones (diff) y colocar los
comentarios arrastrados en el paso correcto.

## Arquitectura

| Pieza | Elección | Por qué |
|---|---|---|
| Front + API | Next.js 16 (App Router, route handlers) en Vercel, región `fra1` | Decisión tomada: todo en Vercel |
| Base de datos | Firestore (proyecto Firebase dedicado, plan Spark) vía `firebase-admin` | Decisión tomada: Firebase solo como BD |
| Ficheros | Vercel Blob **privado**; subida directa con token de un solo fichero; lectura siempre por `/api/files/…` con control de acceso | Sin el límite de 4,5 MB del cuerpo de las funciones; revocar un enlace corta también capturas y vídeos |
| Auth | Cuentas propias (correo + contraseña scrypt), sesión JWT en cookie httpOnly; invitado = cookie firmada atada a un enlace que se comprueba en cada petición; agente = clave `vzk_…` por proyecto (solo se guarda su hash) | Sin dependencias externas; revocable al instante |
| Capturas | Runner Playwright en **la máquina del agente** (`vistazo capture` / `publish --capture`) | Ver «Viabilidad» |
| Web en vivo | iframe + capa de pines; `bridge.js` opcional en la app para anclar a elementos | Funciona con cualquier web que se deje enmarcar |

Permisos: `src/lib/auth.ts` (`access()` decide por proyecto). Invitado: ver, probar, comentar, marcar checklist; no
aprueba, no resuelve. Agente: publicar y leer feedback; no comenta, no resuelve, no aprueba.

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

## Agente (CLI / MCP)

```bash
export VISTAZO_URL=https://vistazo-pi.vercel.app VISTAZO_PROJECT=<id> VISTAZO_API_KEY=vzk_…   # nunca en el repo
cd cli && npm i && npx playwright install chromium
node cli/bin/vistazo.mjs publish --config vistazo.config.json --capture --title "…" --summary "…" --meta rama=…
node cli/bin/vistazo.mjs publish --assets ./capturas --qr "exp+app://…" --title "…"   # app nativa / runner externo
node cli/bin/vistazo.mjs feedback latest            # prompt recomendado (o --summary / --json)
node cli/bin/vistazo.mjs mcp                        # servidor MCP por stdio
```

`vistazo.config.json` (ejemplo real en `demo/vistazo.config.json`): `baseUrl`, `allowHosts` (la CLI se niega a capturar
otros hosts), `viewport`, `mask`, `video` y `flows[]` con `description` en lenguaje natural + `actions` que traduce el
agente (`goto`, `click`, `fill`, `select`, `press`, `waitFor`, `wait`, `expectText`). Secretos con `${env:VAR}`.
Plantillas e instrucciones para agentes y otros runners en `integrations/`.

## Seguridad

- Secretos solo en variables de entorno (`SESSION_SECRET`, `FIREBASE_SERVICE_ACCOUNT_B64`, `BLOB_READ_WRITE_TOKEN`).
  La service account `vistazo-backend` solo tiene `roles/datastore.user`.
- Enlaces de invitado y claves: se guarda el hash; el secreto se muestra una vez. Revocación inmediata.
- Comentarios → prompt: van como JSON dentro de `<reviewer_comments>`, con `<` y `>` escapados para que nadie cierre el
  bloque, y el prompt dice explícitamente que son datos de terceros. Nada se ejecuta solo.
- Los artifacts HTML/SVG se sirven como descarga, nunca se renderizan en el origen de Vistazo.
- `bridge.js` solo habla con la ventana del origen del que se cargó; no envía nada a ningún servidor ni lee formularios.

## Desarrollo

```bash
npm i && vercel env pull .env.local
npm run dev
VISTAZO_URL=… DEMO_PASSWORD=… node scripts/acceptance.mjs   # prueba de punta a punta → evidence/
```

Límites del POC y pendientes: `docs/PENDIENTE.md`. Compatibilidad futura con apps nativas con OTA por PR:
`docs/COMPATIBILIDAD-NATIVA.md` e `integrations/`.
