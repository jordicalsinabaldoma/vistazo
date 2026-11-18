// Texto de terceros (revisores, invitados, la propia web revisada): limpieza y avisos.
//
// Esto NO es la defensa contra la inyección de instrucciones; es una capa más.
// La defensa es estructural (feedback.ts): un solo canal para datos de terceros,
// delimitador imposible de adivinar, persona en el medio y ninguna herramienta
// peligrosa en la CLI/MCP. Aquí se quitan los caracteres que una persona no ve
// (para que lo que revisa sea lo que recibe el agente) y se marcan los textos que
// parecen órdenes para un agente, para que la persona decida si los incluye.

// Caracteres invisibles o que reordenan el texto:
// - U+E0000–U+E007F: «tag characters», sirven para esconder texto ASCII completo.
// - U+E0100–U+E01EF y U+FE00–U+FE0F: selectores de variación (contrabando en emojis).
// - Controles de dirección (bidi), anchura cero, BOM, separador mongol.
// - Controles C0/C1 salvo salto de línea y tabulador.
const INVISIBLE =
  /[\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C\u200B-\u200D\u2060-\u2064\u180E\uFEFF\u00AD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/gu;

export function hasInvisible(s: string) {
  INVISIBLE.lastIndex = 0;
  return INVISIBLE.test(s);
}

/** Limpia un texto de terceros: sin invisibles, NFC, sin avalanchas de saltos de línea. */
export function clean(s: string, max = 4000) {
  return s
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .slice(0, max);
}

// Para comparar: compatibilidad Unicode (＜ → <), minúsculas y sin tildes.
const fold = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const RULES: [string, RegExp][] = [
  [
    "pide ignorar instrucciones",
    /\b(ignora|ignorad|ignore|olvida|olvidad|forget|disregard|omite|salta(te)?)\b.{0,60}\b(instruc\w*|reglas|rules|prompt|anterior\w*|previous|above|arriba|sistema|system)/,
  ],
  [
    "se dirige a un agente o cambia su papel",
    /\b(eres un (agente|asistente|modelo|ia)|you are (an?|the) (agent|assistant|ai|model)|act(ua|úa)? como|act as|a partir de ahora|from now on|system prompt|developer (message|mode)|nuevas instrucciones|new instructions|modo (dios|desarrollador)|jailbreak)\b/,
  ],
  [
    "pide comandos de git o borrar",
    /\bgit\s+(push|reset|rebase|commit|checkout|clean|remote|config|filter-branch)\b|--force\b|\brm\s+-[a-z]*[rf]|\bdrop\s+(table|database)\b|\b(borra|borrad|elimina|eliminad|delete|remove|wipe)\b.{0,40}\b(carpeta|directorio|folder|repo\w*|rama|branch|tests?|base de datos|database|ficheros|archivos|files|historial|history)\b/,
  ],
  ["pide desplegar o publicar", /\b(despliega\w*|desplegar|deploy\w*|vercel\s+(--)?prod|npm\s+publish|merge(a|ar)?\s+(a|en|to|into)\s+(main|master|prod\w*)|push\s+(a|to)\s+(main|master|prod\w*))\b/],
  [
    "pide ejecutar comandos",
    /\b(ejecuta\w*|corre|lanza|run|execute)\b.{0,40}(`|\b(comando|command|script|bash|shell|terminal)\b)|\b(curl|wget|powershell|chmod|sudo|pip\s+install|npm\s+(i|install|exec)|npx\s+\S+|bash\s+-c|sh\s+-c|eval\s*\()/,
  ],
  [
    "pide revelar o enviar secretos",
    /\b(envia\w*|manda\w*|muestra\w*|revela\w*|imprime|pega|comparte|sube|send|reveal|print|share|upload|exfiltr\w*|leak|dump)\b.{0,50}\b(tokens?|api[\s_-]?keys?|secret\w*|secreto\w*|contrasenas?|passwords?|credencial\w*|\.env|ssh|clave(s)? (privada|de api|secreta)|private key|cookies?)\b/,
  ],
  ["abre o descarga enlaces", /\b(abre|abrid|visita|descarga\w*|lee|consulta|fetch|open|visit|download|navigate|ve a|go to)\b.{0,40}https?:\/\//],
  ["imita etiquetas de prompt", /<\/?\s*(reviewer\w*|system|assistant|user|human|instructions?|prompt|tool\w*|im_(start|end)|function\w*|data)\b[^>]*>/],
];

/** Motivos por los que un texto parece una orden para un agente ([] si ninguno). */
export function suspicious(s: string): string[] {
  const out: string[] = [];
  if (hasInvisible(s)) out.push("lleva caracteres ocultos");
  const f = fold(s);
  for (const [why, re] of RULES) if (re.test(f)) out.push(why);
  if (s.length > 2500) out.push("texto muy largo");
  return out;
}
