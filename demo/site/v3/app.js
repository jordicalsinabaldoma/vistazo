// Brasa Tostadores — EMPRESA FICTICIA. App de demo con datos sintéticos para probar Vistazo.
window.BRASA_VERSION = "3.0";
const PRODUCTS = [
  { id: "p1", name: "Etiopía Guji", notes: "Melocotón, jazmín, té negro", price: 12.5, img: "#c8553d" },
  { id: "p2", name: "Colombia Huila", notes: "Panela, naranja, cacao", price: 11, img: "#8c5e3c" },
  { id: "p3", name: "Brasil Cerrado", notes: "Avellana, chocolate con leche", price: 9.9, img: "#5b3a29" },
  { id: "p4", name: "Kenia Nyeri", notes: "Grosella, pomelo, panela", price: 14.2, img: "#a23b4d" },
  { id: "p5", name: "Descafeinado Perú", notes: "Caramelo, nuez", price: 10.4, img: "#7a6a4f" },
  { id: "p6", name: "Blend Casa Brasa", notes: "Cacao, ciruela, especias", price: 8.75, img: "#2f2a26" },
];
const DEMO_USER = { email: "cliente@brasa.test", password: "demo1234", name: "Lucía Demo" };
const store = {
  get cart() { try { return JSON.parse(localStorage.getItem("brasa.cart") || "{}"); } catch { return {}; } },
  set cart(v) { localStorage.setItem("brasa.cart", JSON.stringify(v)); },
  get user() { return localStorage.getItem("brasa.user"); },
  set user(v) { v ? localStorage.setItem("brasa.user", v) : localStorage.removeItem("brasa.user"); },
};
const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
function cartCount() { return Object.values(store.cart).reduce((a, b) => a + b, 0); }
function header() {
  const h = document.querySelector("[data-header]");
  if (!h) return;
  h.innerHTML = `<a href="catalogo.html" class="logo">brasa<span>.</span></a>
    <nav><a href="catalogo.html">Cafés</a><a href="carrito.html" data-testid="nav-cart">Carrito (${cartCount()})</a>
    <button data-testid="logout" onclick="store.user=null;location.href='index.html'">Salir</button></nav>`;
}
function guard() { if (!store.user && !location.pathname.endsWith("index.html") && location.pathname !== "/") location.href = "index.html"; }
document.addEventListener("DOMContentLoaded", () => { header(); document.querySelectorAll("[data-version]").forEach((e) => (e.textContent = "v" + window.BRASA_VERSION)); });
