import { Suspense } from "react";
import { RoutineEditor } from "./RoutineEditor";

export default function RutinaPage() {
  return (
    <Suspense fallback={null}>
      <RoutineEditor />
    </Suspense>
  );
}
