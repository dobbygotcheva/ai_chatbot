# AGENTS.md - AI Agent Guidelines

## Multi-Agent Architecture

This project uses a multi-agent system with specialized agents for different domains.

### Agent Overview

| Agent | Role | Activation |
|-------|------|------------|
| **General** | Coordinator, feature development | Default |
| **Frontend** | React/Next.js, UI, accessibility | UI changes |
| **Backend** | API, database, auth, Redis | Backend changes |
| **Testing** | Playwright E2E, unit tests | Auto-triggered |
| **Code Quality** | Ultracite, linting, reviews | Before commit |
| **DevOps** | GitLab CI, deployments | On demand |

### Agent Configurations

Agent configs are in `.agents/*.json` (at git root):
- `.agents/general.json` - Default coordinator
- `.agents/frontend.json` - UI/components specialist
- `.agents/backend.json` - API/database specialist
- `.agents/testing.json` - Test automation
- `.agents/code-quality.json` - Linting/reviews
- `.agents/devops.json` - CI/CD specialist

### Automatic Handoffs

Agents automatically trigger handoffs:
- **Feature complete** → Testing Agent runs tests
- **Before commit** → Code Quality Agent runs lint
- **API changed** → Frontend + Testing notified
- **Migration created** → DevOps Agent plans deployment

Handoff system: `.agents/handoff.ts` (cycle detection, queue management)

---

## Monorepo Structure

This is a monorepo at `/home/egt/Projects/ai_center/`:

| Project | Purpose | Agent Scope |
|---------|---------|-------------|
| `ai_chatbot/` | Main Next.js application | Full agent support |
| `crawl4ai/` | Web crawling dependency | Read-only (rare modifications) |
| `mcp-atlassian/` | Atlassian integration | Read-only (rare modifications) |

**Agent Scope**: Agents primarily work on `ai_chatbot/`. Other projects are dependencies and should only be modified if absolutely necessary.

---

## Build & Development Commands

### ai_chatbot (Next.js/TypeScript)

```bash
cd ai_chatbot

# Development
pnpm dev              # Start dev server (turbo mode)
pnpm build            # Build production (runs DB migrations first)
pnpm start            # Start production server on 0.0.0.0
pnpm lint             # Run Biome linter via ultracite
pnpm format           # Auto-fix formatting via ultracite

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run pending migrations
pnpm db:studio        # Open Drizzle Studio (DB GUI)
pnpm db:push          # Push schema changes to DB
pnpm db:pull          # Pull schema from DB
pnpm db:check         # Check for schema drift

# Testing
pnpm test                         # Run all tests (unit + integration)
pnpm test:unit                    # Run only unit tests (no DB)
pnpm test:integration             # Run only integration tests (with DB)
pnpm exec playwright test <file>  # Run single E2E test file
pnpm exec playwright test -g "name"  # Run E2E tests matching name
pnpm exec playwright test --ui    # Open Playwright UI mode
```

### crawl4ai (Python)

```bash
cd crawl4ai
# See crawl4ai/README.md for Python-specific commands
```

### mcp-atlassian (Python)

```bash
cd mcp-atlassian
# See mcp-atlassian/README.md for Python-specific commands
```

---

## Code Style Guidelines (ai_chatbot)

### Formatting (Biome/Ultracite)
- 2-space indentation
- Use `pnpm format` to auto-fix
- Semicolons required
- Single quotes preferred

### TypeScript
- No `any` type (use `unknown` if needed)
- Use `as const` instead of type annotations for literals
- Prefer `T[]` over `Array<T>` (or vice versa, be consistent)
- No TypeScript enums (use union types)
- No non-null assertions (`!`)
- Use `import type` / `export type` for types
- No implicit any - always annotate return types

### Imports
- Use `node:` protocol for Node.js builtins
- No namespace imports
- Group imports: React, libraries, local files
- Use absolute imports from project root

### Naming Conventions
- Components: PascalCase (`ChatMessage`, `ModelSelector`)
- Functions/variables: camelCase (`fetchData`, `isLoading`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- Files: kebab-case or matching component name
- Test files: `*.test.ts`

### React/Next.js
- All hooks at top level of component
- Include all dependencies in hook arrays
- Use `key` prop in iterators (not array index)
- Use `<Image>` instead of `<img>` (Next.js)
- No `children` prop with `dangerouslySetInnerHTML`
- Use `<>` instead of `<Fragment>`
- Always include `type` on `<button>` elements

### Accessibility (a11y) - Enforced by Ultracite
- All images need meaningful `alt` text
- All buttons need `type` attribute
- All inputs need associated labels
- No `accessKey` attributes
- No positive `tabIndex` values
- SVGs need `<title>` elements
- Interactive elements must be focusable
- Use semantic HTML over ARIA roles

### Error Handling
- Always pass message to Error constructor
- Use `try/catch` with proper error logging
- Don't swallow errors silently
- Use `useEffect` error boundaries for components
- Return structured error responses: `{ success: false, error: message }`

### Code Quality
- No unused variables, imports, or parameters
- No duplicate conditions or case labels
- No unreachable code
- No `console.log` in production code
- No `eval()` or `Function` constructor
- No `var` - use `const`/`let`
- No assignments in expressions
- Use `===` and `!==` (no loose equality)
- No `else` after early `return`
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### Testing
- No `.only` or `.skip` in committed tests
- Place assertions inside `it()` blocks
- No exports in test files
- Use `data-testid` for stable selectors
- Tests should be isolated and idempotent

---

## Cursor Rules (.cursor/rules/ultracite.mdc)

The `ai_chatbot` project uses Ultracite (Biome-based) with extensive rules for:
- Accessibility compliance (WCAG)
- TypeScript strictness
- React/JSX best practices
- Code complexity limits
- Security (no hardcoded secrets, no dangerous patterns)

Always run `pnpm lint` before committing.

---

## GitLab CI/CD

Branch mapping:
- `development` branch → Staging environment
- `main` branch → Production environment

CI stages: `lint` → `test` → `build` → `deploy-staging` → `deploy-prod`

See `.gitlab-ci.yml` for full pipeline configuration.

---

## Project Structure

```
ai_center/ (git root)
├── .agents/                # Global agent configurations
│   ├── general.json
│   ├── frontend.json
│   ├── backend.json
│   ├── testing.json
│   ├── code-quality.json
│   ├── devops.json
│   ├── handoff.ts          # Handoff system
│   └── handoffs/           # Runtime logs (not committed)
├── ai_chatbot/             # Main application
│   ├── app/                # Next.js app router pages
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities, AI logic, DB schema
│   ├── tests/e2e/          # Playwright E2E tests
│   ├── biome.jsonc         # Biome/Ultracite config
│   ├── playwright.config.ts
│   └── .cursor/            # Cursor rules
├── crawl4ai/               # Web crawling dependency
├── mcp-atlassian/          # Atlassian integration
├── .gitlab-ci.yml          # CI/CD pipeline
└── AGENTS.md               # This file
```

---

## Agent Usage

Agents are **local development tools only** - they don't run in CI.

### How It Works

1. **Auto-coordinate** (default): Just describe what you want to build, and the system coordinates the right agents automatically.

2. **Explicit agents**: Specify which agent when needed:
   ```
   "Frontend Agent: Add dark mode toggle"
   "Backend Agent: Create API endpoint"
   ```

3. **Handoffs**: Agents automatically notify other agents when work crosses domains.

### Handoff Logs

Handoff logs are stored in `.agents/handoffs/` (not committed to git). Useful for:
- Debugging which agent made changes
- Audit trail of agent activity
- Understanding agent coordination patterns

---

## Git Operations - CRITICAL RESTRICTIONS

### What Agents CAN Do

✅ **Commit changes** after completing work
✅ **Stage files** for commits
✅ **Check git status** and logs
✅ **Create branches** for new features
✅ **Run git diff** to review changes

### What Agents CANNOT Do

🚫 **NEVER push to remote** (`git push`)
🚫 **NEVER force push** (`git push --force`)
🚫 **NEVER merge branches**
🚫 **NEVER delete remote branches**

### Push Policy

**Only humans should push to Git.** This ensures:

1. **Human oversight** - A person reviews changes before they reach remote
2. **Accountability** - Clear ownership of what gets pushed
3. **Safety** - Prevents accidental pushes of incomplete or broken code
4. **Control** - Team decides when to share work

### Correct Workflow

```bash
# Agent does:
git add <files>
git commit -m "type(scope): description"

# Human does:
git push origin <branch>  # After reviewing changes
```

**If an agent needs to share work**, it should inform the user:
> "Changes committed to branch `feature-xyz`. Ready for your review and push."
