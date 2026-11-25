import {
  ArrowDown,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarCheck,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const roles = [
  {
    name: "Student",
    icon: GraduationCap,
    description: "Find eligible drives, manage applications, and track each hiring stage.",
  },
  {
    name: "Recruiter",
    icon: BriefcaseBusiness,
    description: "Coordinate campus hiring, review candidates, and record decisions.",
  },
  {
    name: "Placement Officer",
    icon: CalendarCheck,
    description:
      "Approve drives, apply campus eligibility policies, and report placement outcomes.",
  },
  {
    name: "Administrator",
    icon: ShieldCheck,
    description: "Manage access and institution settings, and review audit records.",
  },
];

export function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-10 focus:rounded focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <header className="border-b border-border">
        <nav
          aria-label="Primary"
          className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8"
        >
          <a href="#" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="rounded-xl bg-primary p-2 text-primary-foreground">
              <GraduationCap aria-hidden size={19} />
            </span>
            CampusAI
          </a>
          <a
            href="#roles"
            className="flex items-center gap-1.5 text-sm font-semibold hover:underline"
          >
            Explore roles <ArrowUpRight aria-hidden size={15} />
          </a>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-5 sm:px-8">
        <section
          aria-labelledby="hero-title"
          className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:gap-14"
        >
          <div>
            <p className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground">
              Campus recruitment & placement management
            </p>
            <h1
              id="hero-title"
              className="max-w-xl font-display text-5xl leading-[1.03] tracking-tight sm:text-7xl"
            >
              From campus to career.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
              CampusAI brings placement drives, applications, and hiring outcomes together for
              students, recruiters, and placement teams.
            </p>
            <a href="#roles" className={`${buttonVariants()} mt-7`}>
              Explore the platform <ArrowDown aria-hidden size={17} />
            </a>
          </div>
          <div className="rounded-3xl bg-primary p-6 text-primary-foreground sm:p-9">
            <h2 className="font-display text-3xl">The placement journey</h2>
            <ol className="mt-5 divide-y divide-white/20">
              {[
                ["Discover opportunities", "Find drives and check eligibility."],
                ["Apply and track progress", "Follow reviews, interviews, and decisions."],
                ["Record outcomes", "Track offers and placement results."],
              ].map(([title, description], index) => (
                <li key={title} className="flex items-start gap-4 py-4">
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-[#d4e6b7] text-sm font-bold text-primary"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-[#dce6dc]">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section
          id="roles"
          aria-labelledby="roles-title"
          className="scroll-mt-6 border-t border-border py-12 sm:py-16"
        >
          <h2 id="roles-title" className="font-display text-4xl tracking-tight">
            Who uses CampusAI?
          </h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map(({ name, icon: Icon, description }) => (
              <Card key={name} className="p-5">
                <Icon aria-hidden className="mb-4 rounded-lg bg-muted p-2" size={36} />
                <h3 className="text-lg font-semibold">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            The platform is in development. This page describes the planned workflows.
          </p>
        </section>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-6 text-sm font-semibold sm:px-8">CampusAI</div>
      </footer>
    </>
  );
}
