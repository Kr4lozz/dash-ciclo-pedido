import { Suspense } from "react";
import { GymHub } from "./GymHub";

export default function GymPage() {
  return (
    <Suspense fallback={null}>
      <GymHub />
    </Suspense>
  );
}
