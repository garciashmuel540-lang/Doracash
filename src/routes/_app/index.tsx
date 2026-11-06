import { createFileRoute } from "@tanstack/react-router";
import { QuincenaPanel } from "@/components/quincena-panel";

export const Route = createFileRoute("/_app/")({
  component: QuincenaPanel,
});
