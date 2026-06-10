// Regras de fronteira da arquitetura hexagonal — FRONTEND.
// Instale: npm i -D dependency-cruiser
// Rode manualmente: npx depcruise src --config .dependency-cruiser.cjs
//
// Diferença para o backend: aqui o domínio é proibido de importar React,
// bibliotecas de rede e APIs de browser. O acesso a dados vive nos adapters.

module.exports = {
  forbidden: [
    {
      name: "domain-nao-importa-adapters",
      comment:
        "O domínio não pode depender de adapters (UI nem acesso a dados). Se " +
        "precisa de algo externo, declare um output port e implemente fora.",
      severity: "error",
      from: { path: "src/modules/[^/]+/domain" },
      to: { path: "src/modules/[^/]+/adapters" },
    },
    {
      name: "domain-nao-importa-application",
      comment: "O domínio não conhece os use cases. Dependência aponta para dentro.",
      severity: "error",
      from: { path: "src/modules/[^/]+/domain" },
      to: { path: "src/modules/[^/]+/application" },
    },
    {
      name: "domain-sem-ui-nem-rede",
      comment:
        "O domínio deve ser puro: nada de React, libs de rede ou APIs de browser.",
      severity: "error",
      from: { path: "src/modules/[^/]+/domain" },
      to: {
        path:
          "node_modules/(react|react-dom|next|@tanstack|axios|swr|" +
          "@apollo|graphql-request)",
      },
    },
    {
      name: "componente-nao-fala-com-rede",
      comment:
        "Componentes/hooks (adapters de entrada) não chamam HTTP direto; " +
        "consomem use cases. O acesso a dados vive nos adapters de saída.",
      severity: "error",
      from: { path: "src/modules/[^/]+/adapters/in" },
      to: { path: "node_modules/(axios|swr|@apollo|graphql-request)" },
    },
    {
      name: "sem-dependencia-circular",
      comment: "Ciclos de import quebram a modularidade.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".jsx"] },
  },
};
