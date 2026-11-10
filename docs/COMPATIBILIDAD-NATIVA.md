# Compatibilidad con apps nativas (Expo / React Native) con previews OTA por PR

Genérico: vale para cualquier app Expo/React Native que publique una actualización OTA por pull request
(EAS Update o similar) y la reparta con QR. Nada aquí está conectado a ningún proyecto real.

## Puntos de extensión que ya existen en el núcleo

| Necesidad típica | Punto de extensión en Vistazo |
|---|---|
| La «versión» es una rama OTA por PR, no una URL web | `previews[]` de la revisión: `{ kind: "qr" \| "deeplink" \| "download", label, url, instructions }`. La página de revisión pinta el QR. CLI: `--qr URL --qr-label …` |
| Saber qué build/canal hace falta (runtimeVersion, canal, rama, PR, commit) | `meta` libre de la revisión. CLI: `--meta runtimeVersion=… --meta rama=… --meta pr=…` |
| Sin target web: Playwright no sirve | `vistazo publish --assets <dir>`: carpeta de capturas/vídeos de cualquier runner con la convención `<recorrido>__<paso>[__n].png` o un `manifest.json` |
| E2E existente con Appium/WebdriverIO o Maestro | Guardar capturas con esa convención (plantillas en `integrations/`) |
| Pantallas identificadas por testID / nombres de ruta | Usar el nombre de ruta como `stepKey` y el testID en las notas: así el diff y el arrastre emparejan entre versiones |
| Datos sensibles en pantalla | Capturar solo contra entornos no productivos con datos semilla; `allowHosts` en la config; `mask` en Playwright; en nativo, el runner debe enmascarar antes de subir |
| Login para revisores | Contexto del proyecto/revisión con instrucciones de usuario de prueba **del entorno de pruebas** (nunca credenciales reales en Vistazo) |
| Publicar desde CI y no solo desde el agente | Plantilla de workflow (inactiva) en `integrations/github-actions/` |

## Lo que una app así necesitaría de su lado (fuera de Vistazo)
1. Un entorno no productivo seleccionable por canal/variable de entorno, con datos semilla y usuarios de prueba.
2. Mocks de hardware (escáner, cámara, impresora) para poder recorrer flujos sin dispositivo.
3. Un runner que deje capturas por paso (Appium/WDIO, Maestro) en emulador.
4. Un paso de CI que, tras publicar la OTA de la PR, llame a `vistazo publish --assets … --qr … --meta …`.
5. (Opcional) Devolver el estado de aprobación de Vistazo como check de la PR — pendiente en Vistazo.

## Lo que no cubre el POC
- Comentar en vivo sobre la app nativa (requeriría streaming de emulador).
- Vincular automáticamente la revisión con la PR (hoy: `meta.pr` y el enlace en el comentario-resumen).
