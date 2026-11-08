import { headers } from "next/headers";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import Project from "@/lib/ProjectModel";
import ProjectCard from "@/components/ProjectCard";
import type { ProjectType } from "./actions";

// Projects: a card each, newest first. These are the starting text; once an admin edits a project on the
// site, the saved version (matched by key) is shown instead. To add a project, add it here with a new key.
const PROJECTS: ProjectType[] = [
  {
    key: "willy-work",
    name: "willy.work",
    when: "2026 · Hack Club Stardance",
    about: "This site. A Next.js blog with a 3D spider lily field, a Lily UI, a calendar synced from Todoist, and an About page with a river you can watch the koi in.",
    links: [{ label: "Code", href: "https://github.com/winterrmelonn/willy-blog" }],
  },
  {
    key: "comp",
    name: "comp",
    when: "2026 · Congressional App Challenge",
    about: "Connects students with their school's clubs and volunteer events, and logs community service hours in one place, with a photo and a supervisor's approval for each event. Built with Aaron Pham, Branson Dang and Anthony Lai.",
    links: [{ label: "Code", href: "https://github.com/winterrmelonn/congressional" }],
  },
  {
    key: "aquaplot",
    name: "AquaPlot",
    when: "2026 · IEEE OneAquaHealth Global Hackathon",
    about: "Guided stream checks for volunteers: you name the animals living in your stream, an AI checks your answer without seeing it, and published rules turn the result into a health reading for the water, people and animals nearby.",
    links: [{ label: "Code", href: "https://github.com/BabayoAP/aquaplot" }],
  },
  {
    key: "rustbreeder",
    name: "rustbreeder.py",
    when: "2026 · Hack Club Stardance",
    about: "A plant-breeding calculator for the game Rust: scores and ranks crossbred seeds and predicts offspring genetics.",
    links: [{ label: "Code", href: "https://github.com/winterrmelonn/rustbreeder.py" }],
  },
];

export default async function Projects() {
  const session = await (await initAuth()).api.getSession({ headers: await headers() });
  const admin = !!session && ADMIN_EMAILS.includes(session.user.email);
  await dbConnect();
  const saved = await Project.find().lean<ProjectType[]>();
  const projects = PROJECTS.map((p) => {
    const s = saved.find((d) => d.key === p.key);
    return s ? { key: p.key, name: s.name, when: s.when ?? "", about: s.about ?? "", links: (s.links ?? []).map(({ label, href }) => ({ label, href })), image: s.image } : p;
  });

  return (
    <main className="w-full max-w-2xl mx-auto px-4 pb-10">
      <h1 className="mt-10 mb-6 text-4xl font-bold">Projects</h1>
      <ul className="flex flex-col gap-3">
        {projects.map((p) => <ProjectCard key={p.key} project={p} admin={admin} />)}
      </ul>
    </main>
  );
}
