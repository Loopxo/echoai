import type { MobileProjectSummary } from "../protocol";

export function searchProjects(projects: MobileProjectSummary[], query: string): MobileProjectSummary[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return projects;
  return projects.filter((project) => {
    return project.name.toLowerCase().includes(normalizedQuery) || project.description?.toLowerCase().includes(normalizedQuery);
  });
}
