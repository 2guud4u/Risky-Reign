# Coding Standards

Follow these rules consistently when creating, modifying, or refactoring code in this project.

==================================================
CORE PRINCIPLES
==================================================

1. Optimize for the next person (or model) reading this code, not for cleverness.
2. Prefer boring, explicit code over clever, implicit code.
3. Do not guess at requirements — if something is ambiguous, make the most reasonable assumption, state it briefly, and proceed.
4. Preserve existing architecture and conventions unless there is a clear reason to change them.
5. Do not introduce new patterns, libraries, or abstractions when an existing one already solves the problem.
6. Small, focused changes are better than large, sweeping ones unless a rewrite was explicitly requested.

==================================================
PROJECT STRUCTURE
==================================================

Before writing code:

- Look at how the existing project is organized (folder layout, naming, module boundaries) and follow it.
- If no convention exists yet, pick a conventional structure for the language/framework in use and apply it consistently.
- Do not invent a new structure per feature. Group by responsibility, not by file type, unless the codebase already does otherwise.

Typical responsibility split to default to when none exists:

- `components/` or `views/` — presentation/UI only
- `hooks/` or `services/` — stateful logic, orchestration, side effects
- `utils/` or `lib/` — pure functions, no side effects, no framework/runtime dependencies
- `types/` or inline — shared type/interface definitions
- `constants.*` — shared constant values, no magic numbers scattered in logic

==================================================
SHARED / COMMON CODE (backend + UI)
==================================================

If the project has a shared folder (e.g. `common/`) whose utils/types are imported by both backend and frontend, treat it as a stricter zone than either side individually.

What belongs in `common/`:
- Types/interfaces that represent shared contracts (API request/response shapes, domain entities, enums) — these should be the single source of truth on both sides, not redefined independently in backend and UI.
- Pure utility functions genuinely needed by both sides (formatting, validation logic, math/geometry, domain rule calculations that both a server and a client legitimately need).
- Constants that must stay in sync across backend and UI (e.g. limits, enum values, shared config keys).

What must NOT go in `common/`:
- Anything that imports a runtime/environment-specific dependency — no DOM/browser APIs, no Node-only APIs (`fs`, `path`, `process.env` assumptions), no framework imports (React, Express, your ORM, etc.).
- Anything with side effects: no network calls, no database access, no logging to a specific transport, no reading files.
- UI-only concerns (styling, component state, presentation formatting) or backend-only concerns (persistence, auth session handling, infra config).
- Secrets, credentials, or environment-specific values.

Rules:
- `common/` code must be pure and platform-agnostic — it should run unmodified in both a browser bundle and a server process.
- Treat changes to shared types/utils as a bigger deal than local changes: a change here can silently affect both backend and UI. Check usages on both sides before modifying or removing something.
- Do not duplicate a type or util that already exists in `common/` inside backend- or UI-specific code "to make it easier" — extend or reuse the shared one, or propose moving it if it's currently duplicated.
- If a util starts needing backend-only or UI-only behavior (e.g. diverging validation between client and server), split it: keep the shared pure core in `common/`, and put the platform-specific wrapper on the respective side.
- Prefer generating/deriving backend and UI-specific types from the shared type rather than hand-maintaining parallel versions that can drift out of sync.
- Shared code should have no dependency on either the backend's or the UI's internal modules — dependencies only flow inward from backend/UI into `common/`, never the other way.
- Because shared code has the widest blast radius in the codebase, it's the highest-priority code to unit test.

==================================================
FUNCTION & FILE DESIGN
==================================================

- Each function should do one thing. If a function needs "and" to describe what it does, consider splitting it.
- Each file should have one clear responsibility. If a file mixes rendering, business logic, and data-fetching, consider splitting it.
- Prefer composition over large monolithic functions/classes.
- Avoid deeply nested conditionals — prefer early returns/guard clauses.
- Avoid duplicating logic. If similar code appears in 2–3 places, extract it — but don't over-abstract for a single use case.
- Do not create unnecessary indirection (e.g., a wrapper function that just calls another function with no added value).

File size is a signal, not a rule:

- If a file becomes hard to understand top-to-bottom, consider splitting it.
- Do not split files purely to satisfy a line-count target.

==================================================
NAMING
==================================================

- Names should describe intent, not implementation. `getActiveUsers()` not `filterArr()`.
- Avoid abbreviations unless they're standard in the domain (`id`, `url`, `db` are fine; `usrCfgTmp` is not).
- Booleans should read as questions/predicates: `isValid`, `hasPermission`, `canEdit`.
- Be consistent with casing conventions of the language/framework already in use (e.g., camelCase in JS/TS, snake_case in Python) rather than mixing styles.
- Constants representing meaningful domain values get descriptive names — no unexplained magic numbers or strings.

==================================================
STATE & DATA FLOW
==================================================

- Keep state as close as possible to where it's used. Don't lift state or reach for global/shared state unless it's genuinely shared across multiple independent parts of the app.
- Don't create global state, singletons, or context/providers as a shortcut to avoid prop drilling one or two levels.
- Be explicit about data flow direction (e.g., top-down props, unidirectional state updates) and don't fight the framework's idioms.
- Pure/utility logic must not depend on framework runtime, global state, or side effects (no DOM access, no network calls, no state mutation).

==================================================
SEPARATING CONCERNS
==================================================

Keep these categories distinct wherever the language/framework allows it:

BUSINESS / DOMAIN LOGIC:
- Rules about what is valid, what is allowed, how data should be transformed.
- Should be reusable and testable independent of UI or transport layer.

INTERFACE / PRESENTATION LOGIC:
- Hover/focus/selection state, animations, formatting for display, layout.
- Should not encode business rules.

INFRASTRUCTURE / IO:
- Network calls, database access, file system access, third-party API calls.
- Should be isolated behind a clear interface so it can be mocked/swapped/tested.

Do not duplicate business rules inside UI components, and do not put UI-only state into shared/business logic layers.

==================================================
ERROR HANDLING
==================================================

- Never silently swallow errors. At minimum, log them with enough context to debug.
- Fail loudly during development; fail gracefully (with a clear user-facing message or fallback) in production paths.
- Validate inputs at boundaries (API handlers, form submissions, external data) rather than deep inside business logic.
- Prefer typed/structured errors over generic strings when the language supports it.
- Don't use exceptions/error handling for normal control flow.

==================================================
ASYNC & PERFORMANCE
==================================================

- Avoid unnecessary re-renders/re-computation; memoize only when there's a measurable or obvious reason to, not by default.
- Avoid manual polling (setInterval/setTimeout loops) when an event-driven or reactive approach exists.
- Batch or debounce high-frequency operations (input handlers, resize/scroll listeners, drag interactions) rather than running expensive logic on every event.
- Don't prematurely optimize — write clear code first, then optimize the specific hot path if profiling shows a need.

==================================================
COMMENTS & DOCUMENTATION
==================================================

- Code should be self-explanatory through naming and structure first; comments explain *why*, not *what*.
- Add a comment when logic is non-obvious, encodes a business rule, works around a bug/limitation, or has a subtlety a future reader could easily miss.
- Do not leave commented-out code, TODOs without context, or debug print/log statements in the final result.
- Public functions/modules that are meant to be reused should have a short docstring/comment describing purpose, inputs, and outputs.

==================================================
TESTING
==================================================

- New logic (especially business/domain logic and utilities) should be written to be testable: pure functions, clear inputs/outputs, minimal hidden dependencies.
- If the project has an existing test suite/framework, follow its conventions and add tests for new logic and bug fixes.
- Don't test implementation details (internal state, private helpers) — test observable behavior.
- A bug fix should include a test that would have caught the bug, when practical.

==================================================
DEPENDENCIES
==================================================

- Don't add a new library/package for something that can be reasonably done with what's already in the project or the standard library.
- If a new dependency is genuinely justified, prefer well-maintained, widely used options over obscure or unmaintained ones.
- Don't introduce a second library that overlaps with an existing one already used for the same purpose (e.g., two date libraries, two state managers).

==================================================
SECURITY & SAFETY BASICS
==================================================

- Never hardcode secrets, API keys, credentials, or tokens in source code.
- Sanitize/validate all external input (user input, API responses, file uploads) before using it.
- Use parameterized queries/ORM methods — never build SQL via string concatenation.
- Escape output appropriately for its context (HTML, SQL, shell) to avoid injection issues.
- Don't disable security features (TLS verification, CORS restrictions, auth checks) to "make something work" without flagging it clearly.

==================================================
IMPORTS & ORGANIZATION
==================================================

Prefer a consistent import order (adapt to the language's convention, but keep it consistent):

1. Standard library / language built-ins
2. External/third-party packages
3. Shared `common/` modules (cross backend/UI utils, types, constants)
4. Contexts/providers (UI) or app-level services (backend)
5. Local relative imports (components, hooks, utils, or backend modules/routes)
6. Local types and constants

Group and order imports the same way across the codebase rather than ad hoc per file.

==================================================
REFACTORING RULES
==================================================

When modifying existing code:

1. Identify which responsibility the code belongs to before writing it.
2. Put new code in the file/module that already owns that responsibility; don't default to the largest/most central file out of convenience.
3. Reuse existing utilities/helpers before writing new ones — search the codebase first.
4. Don't duplicate logic that already exists elsewhere.
5. Don't rewrite or reformat unrelated code while making a targeted change (keep diffs focused).
6. If a file is genuinely hard to understand or maintain, propose extracting a component/function/module rather than leaving it to grow further.

==================================================
WHEN ADDING A NEW FEATURE
==================================================

Before writing code, decide:

- Is this rendering/UI? → presentation layer
- Is this stateful interaction or orchestration? → hooks/services layer
- Is this pure calculation/transformation? → utils/lib layer
- Is this a shared constant? → constants file
- Is this a shared type/shape? → types file
- Is this top-level coordination? → the main container/entry file

Do not put everything into the most convenient top-level file. Follow the responsibility split above even under time pressure.

==================================================
GENERAL GOAL
==================================================

- Clear, single-purpose responsibilities per file/function.
- Predictable file/module locations so future changes are easy to locate.
- Minimal duplication.
- Code that is easy to test, easy to review, and easy to safely modify later.
- Consistency with the existing codebase over introducing a "better" personal style.