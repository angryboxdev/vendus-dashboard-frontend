// Service worker mínimo do Portal do Colaborador (scope /portal).
// Só torna a app instalável — NÃO guarda nada em cache nem faz picagem
// offline (decisão do MVP: Entrada/Saída exigem sempre o servidor).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Sem respondWith: o browser trata o pedido normalmente (rede).
});
