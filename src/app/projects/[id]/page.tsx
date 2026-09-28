import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";

// Membuka proyek langsung di tahap yang relevan.
export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    select: { _count: { select: { scenes: true } } },
  });
  if (!project) notFound();
  redirect(`/projects/${id}/${project._count.scenes > 0 ? "script" : "research"}`);
}
