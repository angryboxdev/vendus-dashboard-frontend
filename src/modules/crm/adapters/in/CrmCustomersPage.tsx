import { CrmProvider } from "../../crm.module.tsx";
import { CrmCustomersView } from "./CrmCustomersView.tsx";
export function CrmCustomersPage() { return <CrmProvider><CrmCustomersView /></CrmProvider>; }
