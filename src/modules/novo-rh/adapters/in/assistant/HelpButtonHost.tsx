import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { showsHelpButton } from "../../../domain/services/assistant.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { MezzaAssistantButton } from "./MezzaAssistantButton.tsx";

/**
 * Bolinha da ajuda do RH em todos os ecrãs (menos Escalas, que tem a sua).
 * Só aparece quando a ajuda está disponível para esta pessoa (perfil com
 * acesso e IA configurada); sem resposta, não aparece.
 */
export function HelpButtonHost() {
  const { assistant } = useNovoRh();
  const { pathname } = useLocation();
  const visible = showsHelpButton(pathname);
  const status = useQuery({ queryKey: ["novo-rh", "assistant", "help-status"], queryFn: () => assistant.helpStatus(), staleTime: 5 * 60_000, retry: false, enabled: visible });
  return visible && status.data?.available ? <MezzaAssistantButton help /> : null;
}
