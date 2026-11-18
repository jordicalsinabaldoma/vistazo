# Límites del POC y siguientes pasos

## No incluido / limitado (dicho claro)
- **Sin correo**: no hay recuperación de contraseña ni invitaciones por email. Para añadir un miembro, tiene que tener
  cuenta (se añade por correo desde «Acceso y agente»). El enlace de invitado se copia y se envía a mano.
- **Registro abierto**: cualquiera puede crear cuenta, pero solo ve proyectos donde es miembro. Para uso con empresas
  reales: lista blanca de dominios o invitación obligatoria.
- **Sin rate limiting** en login/registro/enlaces. Necesario antes de exponerlo con datos reales (Vercel Firewall o
  contador en Firestore).
- **Veredictos**: van en transacción. Los comentarios guardados antes del rediseño no se limpian de caracteres
  invisibles al guardarse, pero sí al generar el prompt.
- **Ficheros e invitados**: el invitado de una revisión podría abrir un adjunto de otra revisión de la misma app solo si
  conoce su ruta (aleatoria de 16 caracteres). Cerrarlo del todo requiere guardar la revisión en la ruta del blob.
- **Edición de una revisión publicada**: no se editan; se corrige publicando otra («Partir de vN» en el formulario
  copia recorridos y adjuntos para ordenar, quitar o añadir). Así el historial no se reescribe.
- **Comentar en vivo una app nativa**: requeriría streaming de emulador. Vía actual: QR/deep link + capturas.
- **Diff visual**: compara a baja resolución y agrupa en zonas (rectángulos numerados); sigue sin tolerar
  desplazamientos (si algo empuja el contenido, la zona abarca todo lo de debajo). Siguiente paso: alineado por
  regiones o SSIM, y hacerlo en un worker.
- **PR de GitHub**: solo un enlace (a mano o leído con `gh` por la CLI). Sin sincronizar estado, a propósito. Siguiente
  paso posible: GitHub App de solo lectura (estado al día) y, solo si un equipo lo pide, un check de escritura.
- **Prueba de comportamiento** (`scripts/redteam-feedback.ts`): escrita, sin ejecutar (necesita clave de API y cuesta
  dinero).
- **CLI**: se usa desde el repo (`node cli/bin/vistazo.mjs`); no está publicada en npm.
- **Retención**: los blobs no caducan. Añadir `ttlDays` o limpieza por proyecto.
- **Despliegues protegidos**: para revisar previews protegidas de Vercel haría falta un bypass token por proyecto
  (no implementado, a propósito).

## Siguiente iteración sugerida
1. Rate limiting + lista blanca de dominios.
2. Webhook/acción de CI para publicar por PR y devolver el estado de aprobación como check.
3. Notificaciones (correo/Slack) a revisores al publicar.
4. Diff tolerante y comparación de vídeo por fotogramas clave.
