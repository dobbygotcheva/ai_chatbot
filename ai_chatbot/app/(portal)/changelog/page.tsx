import { promises as fs } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import ChangelogContent from "./changelog-content";

async function getChangelogEntries() {
  const changelogDir = join(process.cwd(), "changelog");

  try {
    const files = await fs.readdir(changelogDir);
    const versionFiles = files.filter(
      (file) => file.endsWith(".md") && file !== "draft.md"
    );

    const entries = await Promise.all(
      versionFiles.map(async (file) => {
        const filePath = join(changelogDir, file);
        const content = await fs.readFile(filePath, "utf8");
        const { data, content: body } = matter(content);

        return {
          version: data.version || file.replace(".md", ""),
          date: data.date || new Date().toISOString().split("T")[0],
          content: body.trim(),
        };
      })
    );

    return entries;
  } catch (error) {
    console.error("Error reading changelog files:", error);
    return [];
  }
}

export default async function ChangelogPage() {
  const entries = await getChangelogEntries();

  if (entries.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
        <p className="text-muted-foreground">No changelog entries yet.</p>
      </div>
    );
  }

  return <ChangelogContent entries={entries} />;
}
