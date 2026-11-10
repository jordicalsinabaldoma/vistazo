// Recorrido grabado en vídeo del control de versiones de Vistazo, contra el despliegue real.
// Una sola ventana: autora → invitado → revisor. Subtítulos y cursor visibles.
//   VISTAZO_URL=… DEMO_PASSWORD=… PROJECT=… node scripts/walkthrough.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, request } from "../cli/node_modules/playwright/index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_ = process.env.VISTAZO_URL.replace(/\/$/, "");
const PW = process.env.DEMO_PASSWORD;
const PID = process.env.PROJECT;
const DEMO = "https://brasa-demo-murex.vercel.app";
const OUT = path.join(ROOT, "evidence", "video");
mkdirSync(OUT, { recursive: true });
const AUTORA = "autora+final@brasa.test";
const REVISOR = "revisor+final@brasa.test";

// ── 0. Fuera de cámara: clave de agente y publicación de v3 desde la CLI ──
const api = await request.newContext({ baseURL: URL_ });
await api.post("/api/auth/login", { data: { email: AUTORA, password: PW } });
const { key } = await (await api.post(`/api/projects/${PID}/keys`, { data: { label: "Vídeo (portátil)" } })).json();
const cliOut = execFileSync(
  "node",
  [path.join(ROOT, "cli/bin/vistazo.mjs"), "publish", "--config", "vistazo.config.json", "--capture",
   "--live-url", `${DEMO}/v3/`, "--title", "Envío gratis y más aire en móvil",
   "--summary", "v3: banner de envío gratis en el catálogo y más espacio bajo el botón Entrar en móvil (comentario de Ana en v2).",
   "--meta", "rama=feature/envio-gratis", "--meta", "commit=demo0003"],
  { cwd: path.join(ROOT, "demo"), env: { ...process.env, VISTAZO_URL: URL_, VISTAZO_PROJECT: PID, VISTAZO_API_KEY: key, BRASA_DEMO_PASSWORD: "demo1234" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const v3Url = cliOut.trim().split("\n").pop();
writeFileSync(path.join(OUT, "cli-publish.txt"), `$ vistazo publish --config vistazo.config.json --capture --live-url ${DEMO}/v3/ --title "Envío gratis y más aire en móvil"\n✓ Publicada v3\n${v3Url}\n`);
await api.dispose();
console.log("v3:", v3Url);

// ── Grabación ──
const browser = await chromium.launch({ slowMo: 90 });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: "es-ES",
  recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
});
await ctx.addInitScript(() => {
  if (window.top !== window) return;
  const css = `#__cur{position:fixed;left:-50px;top:-50px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
    border:3px solid #ff5b1f;background:rgba(255,91,31,.18);pointer-events:none;z-index:2147483647;transition:transform .12s}
    #__cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:88%;z-index:2147483646;pointer-events:none;
    background:#17181c;color:#fff;font:600 19px/1.35 system-ui,sans-serif;padding:12px 20px;border-radius:12px;
    box-shadow:0 8px 30px rgba(0,0,0,.35);text-align:center}#__cap b{color:#ff7a45;margin-right:8px}`;
  const boot = () => {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement("div"); c.id = "__cur"; document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => (c.style.transform = "scale(.6)"), true);
    addEventListener("mouseup", () => (c.style.transform = ""), true);
    const saved = localStorage.getItem("__cap"); if (saved) window.__cap(saved);
  };
  window.__cap = (html) => {
    localStorage.setItem("__cap", html);
    let d = document.getElementById("__cap");
    if (!d) { d = document.createElement("div"); d.id = "__cap"; document.body.appendChild(d); }
    d.innerHTML = html;
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot); else boot();
});

const page = await ctx.newPage();
page.on("dialog", (d) => d.accept());
let n = 0;
const wait = (ms) => page.waitForTimeout(ms);
async function cap(text, ms = 2600) {
  n++;
  await page.evaluate((h) => window.__cap?.(h), `<b>${n}</b>${text}`).catch(() => {});
  await wait(400);
  await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, "0")}.png`) });
  await wait(ms);
}
async function clk(loc, opts) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await wait(250);
  await loc.click(opts);
}
async function type(loc, text) {
  await clk(loc);
  await loc.pressSequentially(text, { delay: 18 });
}
async function login(email) {
  await page.goto(URL_);
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.press("#password", "Enter");
  await page.waitForURL("**/app");
}

try {
  // 1. Proyecto: cada publicación es una versión
  await login(AUTORA);
  await page.goto(`${URL_}/p/${PID}`);
  await page.getByText("v3").first().waitFor();
  await cap("La autora entra en el proyecto. Cada publicación es una versión: v1, v2 (aprobada) y v3", 3500);

  // 2. v3 recién publicada por el agente
  await clk(page.locator("a", { hasText: "Envío gratis y más aire en móvil" }));
  await page.waitForURL("**/r/*");
  await page.getByText("arrastrado de", { exact: false }).first().waitFor();
  await cap("v3 la acaba de publicar el agente desde la terminal (capturas y vídeo con Playwright)", 3200);

  // 3. Arrastre
  await page.locator("[data-testid=comment]").first().hover();
  await cap("Los comentarios que seguían abiertos en v2 se han arrastrado solos a v3", 3500);

  // 4. Selector de versión
  const sel = page.getByLabel("Versión");
  const sb = await sel.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 18 });
  await cap("Con el selector de arriba cambias de versión. Las anteriores no se modifican", 1500);
  await sel.selectOption({ index: 2 });
  await page.waitForURL((u) => !u.href.endsWith(v3Url.split("/r/")[1]));
  await page.getByText("Hay una versión más reciente").waitFor();
  await clk(page.getByRole("button", { name: /Todos/ }));
  await cap("v1 tal como quedó: sus comentarios, sus respuestas y quién resolvió cada uno", 3500);
  await page.goto(v3Url);

  // 5. Diff
  await clk(page.getByRole("button", { name: /Cambios desde v2/ }));
  await wait(2500);
  await cap("«Cambios desde v2»: en rojo, los píxeles que cambian entre versiones", 2000);
  await page.mouse.wheel(0, 650);
  await wait(1200);
  await cap("Catálogo: el banner nuevo de «Envío gratis» aparece marcado", 2500);
  await clk(page.getByRole("button", { name: "Lado a lado" }).nth(1));
  await wait(1500);
  await cap("También lado a lado (y con deslizador)", 2500);
  await page.mouse.wheel(0, -3000);

  // 6. Responder y resolver
  await clk(page.getByRole("button", { name: /Recorridos/ }));
  const cm = page.locator("[data-testid=comment]").filter({ hasText: "En móvil el botón" });
  await clk(cm);
  await type(cm.locator('input[placeholder="Responder…"]'), "Hecho en v3: más espacio bajo el botón.");
  await cap("La autora responde al comentario de móvil…", 1500);
  await clk(cm.getByRole("button", { name: /Resolver/ }));
  await wait(1500);
  await cap("…y lo resuelve. Resolver no es aprobar: la v3 sigue «En revisión»", 3200);

  // 7. Enlace de invitado
  await page.goto(`${URL_}/p/${PID}`);
  await clk(page.getByRole("button", { name: "Acceso y agente" }));
  await type(page.locator('input[placeholder="p. ej. Diseñadora externa"]'), "Diseñadora (vídeo)");
  await clk(page.getByRole("button", { name: "Crear enlace" }));
  await page.getByTestId("secret").filter({ hasText: "/s/" }).waitFor();
  const link = (await page.getByTestId("secret").textContent()).trim();
  await cap("Comparte un enlace de invitado: solo para este proyecto, caduca y se puede revocar", 3200);

  // 8. Invitado
  await clk(page.getByRole("button", { name: "Salir" }));
  await page.waitForURL(URL_ + "/");
  await page.goto(link);
  await type(page.locator("#gn"), "Ana (diseñadora)");
  await cap("La diseñadora abre el enlace sin crear cuenta", 1800);
  await clk(page.getByRole("button", { name: "Entrar a la revisión" }));
  await page.waitForURL("**/r/*");
  await page.getByText("Aprobar (requiere cuenta)").waitFor();
  await clk(page.getByRole("button", { name: /Catálogo/ }));
  const img = page.locator("[data-testid^=asset-]").first();
  await img.waitFor();
  await wait(800);
  const b = await img.boundingBox();
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.255, { steps: 20 });
  await page.mouse.click(b.x + b.width * 0.2, b.y + b.height * 0.255);
  await type(page.getByTestId("composer"), "El banner queda bien, pero yo lo pondría encima del título.");
  await clk(page.getByRole("button", { name: "Comentar", exact: true }));
  await wait(1200);
  await cap("Comenta sobre una captura: el pin queda anclado a ese punto", 3000);

  // 9. Web en vivo
  await clk(page.getByRole("button", { name: "En vivo" }));
  const fr = page.frameLocator('iframe[title="App en vivo"]');
  await fr.locator("[data-testid=email]").fill("cliente@brasa.test");
  await fr.locator("[data-testid=password]").fill("demo1234");
  await fr.locator("[data-testid=login]").click();
  await fr.locator("[data-testid=promo]").waitFor();
  await page.getByText("Puente conectado").waitFor({ timeout: 15000 });
  await cap("También prueba la app de verdad, dentro de Vistazo", 2200);
  await clk(page.getByRole("button", { name: "Comentar sobre la web" }));
  await wait(400);
  const promo = fr.locator("[data-testid=promo]");
  const pb = await promo.boundingBox();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 20 });
  await wait(500);
  await promo.click();
  await type(page.getByTestId("composer"), "¿«25 €» incluye IVA? Aclararlo en el banner.");
  await clk(page.getByRole("button", { name: "Comentar", exact: true }));
  await wait(1500);
  await cap("Y comenta sobre la web en vivo: queda anclado al elemento exacto", 3200);
  await page.getByText("Aprobar (requiere cuenta)").hover();
  await cap("Como invitada no puede aprobar: eso es solo para usuarios identificados", 3000);

  // 10. Revisor aprueba
  await login(REVISOR);
  await page.goto(v3Url);
  await page.getByText("Flujos críticos").waitFor();
  await cap("El revisor identificado abre la v3 y repasa la checklist de flujos críticos", 2200);
  for (const t of ["Compra completa hasta el pago", "El error de login se entiende", "Se ve bien en móvil"]) {
    await clk(page.locator("li").filter({ hasText: t }).getByTitle("Funciona"));
    await wait(700);
  }
  await clk(page.getByRole("button", { name: "Feedback para el agente" }));
  await page.getByTestId("feedback-text").waitFor();
  await wait(1500);
  await cap("«Feedback para el agente»: el prompt con los comentarios pendientes, listo para pegar en Claude", 3500);
  await page.mouse.click(30, 400);
  await wait(500);
  await clk(page.getByRole("button", { name: "✓ Aprobar revisión" }));
  await page.getByTestId("approved").waitFor();
  await cap("Aprueba la v3 de forma explícita. Es una aprobación visual: no hace merge ni deploy", 3500);

  // 11. Historial
  await page.goto(`${URL_}/p/${PID}`);
  await page.getByText("v3").first().waitFor();
  await cap("Historial del proyecto: v1, v2 y v3, cada una con quién la publicó y quién la aprobó", 4000);
} finally {
  const vid = page.video();
  await ctx.close();
  await browser.close();
  if (vid) renameSync(await vid.path(), path.join(OUT, "recorrido.webm"));
}
