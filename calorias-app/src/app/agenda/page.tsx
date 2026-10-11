import { Suspense } from "react";
import { AgendaScreen } from "./AgendaScreen";

export default function AgendaPage() {
  return (
    <Suspense fallback={null}>
      <AgendaScreen />
    </Suspense>
  );
}
