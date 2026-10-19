/**
 * Classe da área principal (ao lado da sidebar). No Novo RH corta na
 * horizontal sem se tornar contentor de scroll (`overflow-x: clip`): quem faz
 * scroll é a janela e os elementos `sticky` (cabeçalho, painel «Atribuir
 * turnos») acompanham-no. Com `overflow: auto` o `<main>` passava a ser o
 * contentor do `sticky` sem nunca fazer scroll, e o painel ficava no topo.
 * Nos outros módulos fica como estava.
 */
export function appMainClass(pathname: string): string {
  const novoRh = pathname === "/hr/novo" || pathname.startsWith("/hr/novo/");
  return `min-w-0 flex-1 pt-12 md:pt-0 ${novoRh ? "overflow-x-clip" : "overflow-auto"}`;
}
