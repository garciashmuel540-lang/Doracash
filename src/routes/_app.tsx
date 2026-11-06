import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/_app")({
  component: function AppLayout() {
    return (
      <Shell>
        <Outlet />
      </Shell>
    );
  },
});
