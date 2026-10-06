/** Acesso ao Portal do Colaborador na ficha — contrato com `/api/hr/people/:id/portal-access`. */
export interface PortalAccess {
  hasAccess: boolean;
  email: string | null;
  /** `employee` = conta só do Portal; `staff` = conta de gestão ligada à ficha (gestor que também é colaborador). */
  accountKind: "employee" | "staff" | null;
}

export interface GrantPortalAccessResult extends PortalAccess {
  /** Só quando foi criada uma conta nova — mostrar UMA vez ao gestor. */
  temporaryPassword: string | null;
}
