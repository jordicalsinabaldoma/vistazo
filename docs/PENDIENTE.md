# Límites del POC y siguientes pasos

## No incluido / limitado (dicho claro)
- **Sin correo**: no hay recuperación de contraseña ni invitaciones por email. Para añadir un miembro, tiene que tener
  cuenta (se añade por correo desde «Acceso y agente»). El enlace de invitado se copia y se envía a mano.
- **Registro abierto**: cualquiera puede crear cuenta, pero solo ve proyectos donde es miembro. Para uso con empresas
  reales: lista blanca de dominios o invitación obligatoria.
- **Sin rate limiting** en login/registro/enlaces. Necesario antes de exponerlo con datos reales (Vercel Firewall o
  contador en Firestore).
- **Aprobaciones**: lectura-y-escritura sin transacción (dos aprobaciones simultáneas podrían pisarse). Aceptable en POC.
- **Edición de una revisión publicada**: no se editan; se corrige publicando otra («Partir de vN» en el formulario
  copia recorridos y adjuntos para ordenar, quitar o añadir). Así el historial no se reescribe.
- **Comentar en vivo una app nativa**: requeriría streaming de emulador. Vía actual: QR/deep link + capturas.
- **Diff visual**: píxel a píxel en el navegador, sin tolerancia a desplazamientos (un cambio de altura arriba marca
  todo lo de abajo). Siguiente paso: alineado por regiones o SSIM.
- **CLI**: se usa desde el repo (`node cli/bin/vistazo.mjs`); no está publicada en npm.
- **Retención**: los blobs no caducan. Añadir `ttlDays` o limpieza por proyecto.
- **Despliegues protegidos**: para revisar previews protegidas de Vercel haría falta un bypass token por proyecto
  (no implementado, a propósito).

## Siguiente iteración sugerida
1. Rate limiting + lista blanca de dominios.
2. Webhook/acción de CI para publicar por PR y devolver el estado de aprobación como check.
3. Notificaciones (correo/Slack) a revisores al publicar.
4. Diff tolerante y comparación de vídeo por fotogramas clave.
