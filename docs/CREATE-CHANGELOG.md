# Changelog Workflow

The changelog system generates user-facing release notes from git commits using conventional commits.

## Structure

Changelog files are stored in `ai_chatbot/changelog/`:

- `*.md` - Versioned changelog files (e.g., `0.1.0.md`, `0.2.0.md`)
- `draft.md` - Auto-generated draft (not committed, gitignored)
- `README.md` - Local reference (optional, can be removed)

## Generating a Changelog Draft

When preparing a new release:

```bash
cd ai_chatbot
pnpm changelog:draft 0.2.0
```

This will:
1. Scan up to 1000 recent git commits (excluding merge commits)
2. Extract conventional commits: `feat:`, `fix:`, `bug:`, `chore:`, `refactor:`
3. Filter out noise (WIP, stash artifacts, merge commits)
4. Generate a categorized draft in `ai_chatbot/changelog/draft.md`

## Commit Types

The script recognizes these conventional commit types:

- `feat:` → **Features** section
- `fix:` / `bug:` → **Bug Fixes** section
- `refactor:` → **Internal Changes → Refactoring** section
- `chore:` → **Internal Changes → Maintenance** section

## Project Manager Workflow

1. **Generate draft**: Developer runs `pnpm changelog:draft <version>`
2. **Review**: PM opens `ai_chatbot/changelog/draft.md` and reviews the auto-generated content
3. **Edit**: PM edits the draft to:
   - Remove internal/technical items (especially from "Internal Changes" section)
   - Rewrite descriptions for clarity
   - Add business context
   - Consolidate similar items
   - Reorganize sections
4. **Finalize**: Rename `draft.md` to `<version>.md`
5. **Commit**: Add the versioned file to git

## Example Edit

**Before (auto-generated):**
```markdown
## Features
- Add token encryption
- Lazy load config
- Lazy load provider config as well

## Internal Changes
### Maintenance
- Add needed env vars to the build
```

**After (PM edited for public changelog):**
```markdown
## Features
- Enhanced security with token encryption
- Improved performance with lazy configuration loading
```

## File Format

Each version file uses frontmatter:

```markdown
---
version: 0.2.0
date: 2026-03-30
---

## Features

- User-facing feature description
- Another feature

## Bug Fixes

- Bug fix description

## Internal Changes

### Refactoring
- Code improvements (optional - usually removed before publishing)

### Maintenance
- Dependency updates (optional - usually removed before publishing)
```

## Commands

```bash
# Navigate to ai_chatbot directory
cd ai_chatbot

# Generate draft for version 0.2.0
pnpm changelog:draft 0.2.0

# Or run the script directly
node scripts/generate-changelog-draft.js 0.2.0
```

## Script Features

- **Smart filtering**: Automatically excludes merge commits, WIP commits, and stash artifacts
- **Commit range detection**: Compares against the last versioned changelog file
- **Fallback handling**: If no previous version exists, scans the last 1000 commits
- **Noise reduction**: Filters out non-conventional commits and git artifacts
- **Categorized output**: Organizes changes by type (Features, Fixes, Internal)

## Best Practices

1. **Generate drafts frequently**: Create drafts during release preparation, not at the last minute
2. **PM review is essential**: Auto-generated content should always be reviewed and edited
3. **Keep it user-focused**: Remove technical implementation details from public changelog
4. **Consolidate related changes**: Group multiple commits about the same feature
5. **Use clear language**: Rewrite commit messages to be understandable by end users

## Git Ignore

The `draft.md` file is automatically ignored by git (configured in `.gitignore`):

```
ai_chatbot/changelog/draft.md
```

This ensures that only reviewed and approved versioned files are committed.

## Troubleshooting

### No commits found
- Ensure you're running from the `ai_chatbot` directory
- Check that git history is available in your current branch
- Verify conventional commit format in your commits

### Too many internal changes
- This is expected! The PM should review and remove internal items
- Consider adding more specific commit messages for future releases

### Version comparison issues
- The script looks for the highest version number in `changelog/*.md` files
- Ensure version files follow semantic versioning format (e.g., `0.1.0.md`)
