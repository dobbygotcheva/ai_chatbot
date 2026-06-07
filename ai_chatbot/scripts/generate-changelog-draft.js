#!/usr/bin/env node

/**
 * Generate changelog draft from git commits using conventional commits
 *
 * Usage: node scripts/generate-changelog-draft.js [version]
 * Example: node scripts/generate-changelog-draft.js 0.2.0
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const changelogDir = join(rootDir, "changelog");

// Get version from argument or prompt
const version = process.argv[2];

if (!version) {
  console.error("Usage: node scripts/generate-changelog-draft.js [version]");
  console.error("Example: node scripts/generate-changelog-draft.js 0.2.0");
  process.exit(1);
}

// Get the last version file to determine the range
const versionFiles = existsSync(changelogDir)
  ? Array.from(readdirSync(changelogDir))
      .filter((f) => f.endsWith(".md") && f !== "draft.md" && f !== "README.md")
      .sort((a, b) => {
        const aVersion = a.replace(".md", "");
        const bVersion = b.replace(".md", "");
        return compareVersions(bVersion, aVersion); // Descending
      })
  : [];

const lastVersion =
  versionFiles.length > 0 ? versionFiles[0].replace(".md", "") : null;

console.log(`Generating changelog draft for version ${version}...`);
if (lastVersion) {
  console.log(`Comparing against version ${lastVersion}`);
}

// Build git log command with better error handling
const maxCount = 1000;
const gitLogOptions = `--max-count=${maxCount} --no-merges --pretty=format:"%h|%s|%b"`;

let gitLogCommand;
if (lastVersion) {
  try {
    // Try to use tag range first
    execSync(`git rev-parse v${lastVersion}`, { stdio: "pipe", cwd: rootDir });
    gitLogCommand = `git log v${lastVersion}..HEAD ${gitLogOptions} --reverse`;
    console.log(`Using commit range: v${lastVersion}..HEAD`);
  } catch {
    // Tag doesn't exist, fall back to commit count
    gitLogCommand = `git log ${gitLogOptions} --reverse`;
    console.log(
      `Tag v${lastVersion} not found, using last ${maxCount} commits instead`
    );
  }
} else {
  gitLogCommand = `git log ${gitLogOptions} --reverse`;
  console.log(`No previous version found, using last ${maxCount} commits`);
}

// Execute git log
let commits = [];
try {
  const output = execSync(gitLogCommand, { cwd: rootDir, encoding: "utf8" });
  commits = output.split("\n").filter((line) => line.trim());
} catch (error) {
  console.error("Error getting git log:", error.message);
  console.log("Trying simplified approach...");

  try {
    const output = execSync(`git log ${gitLogOptions} --reverse`, {
      cwd: rootDir,
      encoding: "utf8",
    });
    commits = output.split("\n").filter((line) => line.trim());
  } catch (error2) {
    console.error("Failed to get commits:", error2.message);
    process.exit(1);
  }
}

console.log(`Found ${commits.length} commits to analyze`);

// Filter out noise commits (stash, merge artifacts, etc.)
const noisePatterns = [
  /^WIP on /i,
  /^index on /i,
  /^Merge branch /i,
  /^Merge pull request /i,
  /^Merge remote-tracking branch /i,
];

const cleanCommits = commits.filter((commit) => {
  const [, subject = ""] = commit.split("|");
  return !noisePatterns.some((pattern) => pattern.test(subject));
});

console.log(`Filtered to ${cleanCommits.length} commits after removing noise`);

// Parse commits and categorize by conventional commit types
const features = [];
const fixes = [];
const chores = [];
const refactors = [];

for (const commit of cleanCommits) {
  const [, subject, body = ""] = commit.split("|");
  const message = `${subject}\n${body}`.trim();

  // Skip if subject is empty or just whitespace
  if (!subject?.trim()) {
    continue;
  }

  // Check for conventional commit types
  const featMatch = message.match(/^feat(?:\([^)]+\))?:\s*(.+)/i);
  const fixMatch = message.match(/^(?:fix|bug)(?:\([^)]+\))?:\s*(.+)/i);
  const choreMatch = message.match(/^chore(?:\([^)]+\))?:\s*(.+)/i);
  const refactorMatch = message.match(/^refactor(?:\([^)]+\))?:\s*(.+)/i);

  if (featMatch) {
    const description = featMatch[1].trim();
    features.push(`- ${capitalizeFirst(description)}`);
  } else if (fixMatch) {
    const description = fixMatch[1].trim();
    fixes.push(`- ${capitalizeFirst(description)}`);
  } else if (choreMatch) {
    const description = choreMatch[1].trim();
    chores.push(`- ${capitalizeFirst(description)}`);
  } else if (refactorMatch) {
    const description = refactorMatch[1].trim();
    refactors.push(`- ${capitalizeFirst(description)}`);
  }
}

// Generate markdown
const today = new Date().toISOString().split("T")[0];
const sections = [];

sections.push("## Features");
sections.push(features.length > 0 ? features.join("\n") : "- No new features");

sections.push("");
sections.push("## Bug Fixes");
sections.push(fixes.length > 0 ? fixes.join("\n") : "- No bug fixes");

if (chores.length > 0 || refactors.length > 0) {
  sections.push("");
  sections.push("## Internal Changes");

  if (refactors.length > 0) {
    sections.push("");
    sections.push("### Refactoring");
    sections.push(refactors.join("\n"));
  }

  if (chores.length > 0) {
    sections.push("");
    sections.push("### Maintenance");
    sections.push(chores.join("\n"));
  }
}

const markdown = `---
version: ${version}
date: ${today}
---

${sections.join("\n")}

---

**Instructions for PM:**
- Review the items above and edit as needed
- Remove items that shouldn't be in the public changelog (especially Internal Changes)
- Rewrite descriptions for clarity if needed
- Move items between sections as needed
- Save this file as ${version}.md when ready to commit
`;

// Write draft file (create directory if needed)
if (!existsSync(changelogDir)) {
  mkdirSync(changelogDir, { recursive: true });
}
const draftPath = join(changelogDir, "draft.md");
writeFileSync(draftPath, markdown);

console.log("");
console.log("✅ Draft generated: changelog/draft.md");
console.log("");
console.log("Summary:");
console.log(`  Features: ${features.length}`);
console.log(`  Bug Fixes: ${fixes.length}`);
console.log(`  Refactoring: ${refactors.length}`);
console.log(`  Maintenance: ${chores.length}`);
console.log("");
console.log("Next steps:");
console.log("  1. Review changelog/draft.md");
console.log("  2. Edit and augment as needed");
console.log(`  3. Rename to changelog/${version}.md when ready`);
console.log("  4. Commit the versioned file");

// Helper functions
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function compareVersions(a, b) {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;

    if (aPart !== bPart) {
      return aPart - bPart;
    }
  }

  return 0;
}
