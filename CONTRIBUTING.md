# Contribuir

Gracias por echar una mano. Para un cambio grande, abre antes una issue y lo hablamos.

## Montarlo en local (sin tocar ninguna base de datos real)

```bash
npm i && (cd cli && npm i)
cp .env.example .env.local        # SESSION_SECRET: openssl rand -base64 48
# Emulador de Firestore (necesita Java) en el puerto 8085, en lugar de un proyecto de Firebase.
# Con firebase-tools: firebase emulators:start --only firestore (con un firebase.json que fije el puerto 8085)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 FIREBASE_PROJECT_ID=vistazo-local npm run dev -- -p 3100
```

Sin `BLOB_READ_WRITE_TOKEN` no se pueden subir capturas, pero todo lo demás funciona.

## Antes de abrir la PR

```bash
npm test          # aislamiento del prompt y formato del kit
npx tsc --noEmit
npm run lint
VISTAZO_URL=http://localhost:3100 PROJECT=<id> DEMO_PASSWORD=… node scripts/e2e.mjs   # circuito completo, solo en local
```

- Interfaz en español, frases cortas, sin jerga. Las reglas visuales están en `DESIGN.md`
  y las de producto en `PRODUCT.md`.
- Nunca datos reales en ejemplos, capturas ni tests: usa dominios `.test` y empresas inventadas.
- Nada de secretos en commits. Si se te escapa uno, revócalo primero y avísame.
- Todo lo que escribe un revisor es dato de terceros: si tocas `src/lib/feedback.ts` o
  `src/lib/untrusted.ts`, añade casos a `tests/feedback.test.ts`.
