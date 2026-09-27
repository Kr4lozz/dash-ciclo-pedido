import { Suspense } from "react";
import { AddFood } from "./AddFood";

export default function AgregarPage() {
  return (
    <Suspense fallback={null}>
      <AddFood />
    </Suspense>
  );
}
