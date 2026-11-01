import type { ReactNode } from "react";
import { PlantifyMark } from "@/components/plantify-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** The card every auth page sits in: mark, centred title and description, then the form. */
export function AuthShell({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: ReactNode;
  /** Replaces the Plantify mark, e.g. a mail icon on the verify page. */
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md px-4 py-10 sm:py-16">
      <Card className="w-full gap-6 [--card-spacing:--spacing(6)]">
        <CardHeader className="justify-items-center gap-3 text-center">
          {icon ?? <PlantifyMark size="lg" />}
          <CardTitle role="heading" aria-level={1} className="text-xl font-bold tracking-tight">
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">{children}</CardContent>
      </Card>
    </div>
  );
}

/** A thin "or" separator between the main action and the alternatives. */
export function OrDivider({ children = "or" }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Inline form error; screen readers hear it as soon as it appears. */
export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
