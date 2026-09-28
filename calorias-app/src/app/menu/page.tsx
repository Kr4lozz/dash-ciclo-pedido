import { Suspense } from "react";
import { MenuScreen } from "./MenuScreen";

export default function MenuPage() {
  return (
    <Suspense fallback={null}>
      <MenuScreen />
    </Suspense>
  );
}
