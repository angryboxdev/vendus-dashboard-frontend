/**
 * Catálogo de origem (pt-PT). Chaves planas `área.texto`; parâmetros `{nome}`.
 * Textos escritos de raiz (task RH §4.1). Ao acrescentar uma chave aqui,
 * acrescentar também em es-ES (ou fica a usar o texto pt-PT até ser traduzida).
 */
export const ptPT = {
  "common.inDevelopment": "Em desenvolvimento",
  "common.done": "Concluída",
  "common.inProgress": "Em curso",
  "common.planned": "Planeada",

  "novoRh.title": "Novo RH",
  "novoRh.description": "O novo modelo de RH e assiduidade, construído por fases. O RH atual continua a funcionar como sempre.",
  "novoRh.banner.title": "Área separada do RH atual",
  "novoRh.banner.body": "Aqui vê o que está a ser construído. Nada desta área altera os dados ou os ecrãs do RH atual. Quando estiver completo e validado, pode passar a ser o RH principal.",
  "novoRh.mode.label": "Modo de dados",
  "novoRh.mode.real": "Real",
  "novoRh.mode.demo": "Demonstração",
  "novoRh.mode.demoHint": "A organização de demonstração, com dados fictícios, fica disponível depois da Fase 1.",
  "novoRh.roadmap.title": "Plano por fases",
  "novoRh.roadmap.progress": "{done} de {total} fases concluídas",
  "novoRh.phase.0": "Preparação",
  "novoRh.phase.0.desc": "Base técnica: verificações automáticas, erros padronizados, proteção contra pedidos repetidos, dados de demonstração.",
  "novoRh.phase.1": "Fundação",
  "novoRh.phase.1.desc": "Acessos por âmbito, organização e motor de configurações com histórico.",
  "novoRh.phase.2": "Pessoas e contratos",
  "novoRh.phase.2.desc": "Ficha do colaborador, contratos com vigência e transferências entre centros.",
  "novoRh.phase.3": "Horários e calendários",
  "novoRh.phase.3.desc": "Horários-modelo, calendários por centro e o tempo teórico de cada dia.",
  "novoRh.phase.4": "Ponto e assiduidade",
  "novoRh.phase.4.desc": "Marcações, turnos que passam a meia-noite, ocorrências sem duplicados e correções com motivo.",
  "novoRh.phase.5": "Ausências e aprovações",
  "novoRh.phase.5.desc": "Pedidos, fluxos de aprovação sem autoaprovação e saldos por movimentos.",
  "novoRh.phase.6": "Banco de horas",
  "novoRh.phase.6.desc": "Saldo diário por movimentos, compensações e correções retroativas com ajuste.",
  "novoRh.phase.7": "Escalas e turnos",
  "novoRh.phase.7.desc": "Escalas com regras de aviso ou bloqueio, publicação e histórico de versões.",
  "novoRh.phase.8": "Fecho e exportação",
  "novoRh.phase.8.desc": "Fecho de período, reabertura com dupla aprovação e exportação para salários.",
  "novoRh.phase.9": "Comunicação e alertas",
  "novoRh.phase.9.desc": "Comunicados com confirmação, notificações, alertas com ciclo completo e relatórios.",
} as const;

export type MessageKey = keyof typeof ptPT;
