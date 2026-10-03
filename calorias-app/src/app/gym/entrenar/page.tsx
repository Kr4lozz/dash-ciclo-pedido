import { Suspense } from "react";
import { WorkoutScreen } from "./WorkoutScreen";

export default function EntrenarPage() {
  return (
    <Suspense fallback={null}>
      <WorkoutScreen />
    </Suspense>
  );
}
