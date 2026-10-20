import { SelectionScreen } from "../cart/popup/selection-screen";
import { SuppliersScreen } from "../suppliers/popup/suppliers-screen";
import { HelpScreen } from "./help/help-screen";
import { useRoute } from "./router";

export function App() {
  const route = useRoute();
  return (
    <main className="flex w-[380px] flex-col bg-surface font-sans text-ink">
      {route === "/suppliers" ? (
        <SuppliersScreen />
      ) : route === "/help" ? (
        <HelpScreen />
      ) : (
        <SelectionScreen />
      )}
    </main>
  );
}
