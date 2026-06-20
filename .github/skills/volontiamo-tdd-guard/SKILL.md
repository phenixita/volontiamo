---
name: volontiamo-tdd-guard
description: 'Enforce a TDD-first workflow for Volontiamo changes. Use when implementing or fixing backend or web behavior, especially in volontiamo.domain, API endpoints, and related L0 or L1 tests. Chooses the lowest viable test seam, writes or updates a failing test first when practical, keeps edits narrow, and validates immediately after each change.'
argument-hint: 'Describe the change slice, failing behavior, or target file/module'
---

# Volontiamo TDD Guard

Use this skill for code changes that should follow the repository's TDD rules and validation discipline.

This skill is specific to this repository:
- prefer L0 unit tests over L1 integration tests
- keep business logic in `volontiamo.domain`, not in `volontiamo.api`
- use dedicated in-memory test implementations instead of mocking libraries for L0 when a dependency seam is needed
- validate the touched slice immediately after the first substantive edit

## When to Use

- Implementing a new behavior
- Fixing a bug with a reproducible failing path
- Refactoring domain or API code without changing behavior
- Touching a slice that spans `volontiamo.domain`, `volontiamo.api`, `volontiamo.domain.test.L0`, or `volontiamo.api.tests.L1`
- Needing a guardrail against jumping too early to manual testing or broad end-to-end validation

## Inputs to Collect

Start from the most concrete anchor available:
- failing test name
- target file or symbol
- failing endpoint or behavior
- validation command that currently fails

If the request is vague, identify one nearby owning module before doing broader exploration.

## Procedure

1. Identify the behavioral seam.
Choose the smallest module interface that directly controls the requested behavior. Prefer an existing domain module seam over wiring code.

2. Pick the lowest viable test level.
Default to L0 in `src/volontiamo.domain.test.L0`.
Use L1 in `src/volontiamo.api.tests.L1` only if the behavior truly depends on HTTP, EF persistence, auth wiring, or other integration concerns that cannot be proven at L0.

3. Form one falsifiable local hypothesis.
State what is likely wrong or what behavior is missing, the local code path that controls it, and the cheapest check that could disconfirm that hypothesis.

4. Add or tighten the test first when practical.
Prefer a narrow failing test that names the intended behavior.
For L0, create dedicated in-memory adapters instead of mocks when a dependency seam is required.
If a test already exists but is too broad, tighten it before editing production code.

5. Run the narrowest failing validation.
Use the smallest executable check that can falsify the hypothesis:
- targeted L0 test
- targeted L1 test
- narrow lint or typecheck for the touched frontend slice
- only fall back to broader validation when no narrower check exists

6. Make the smallest grounded production edit.
Edit only the module that directly computes or controls the behavior. Avoid spreading logic into controllers, endpoints, or pass-through layers when the domain seam can hold it.

7. Validate immediately after the first substantive edit.
Do not widen scope before rerunning the same focused validation.
If it fails but confirms the hypothesis, repair the same slice and rerun.
If it falsifies the hypothesis, step one hop closer to the actual controlling code path.

8. Escalate validation only as needed.
After the narrow check passes, run the next relevant level only if the touched behavior crosses that seam:
- L0 only for domain-only behavior
- L0 then L1 for API behaviors backed by domain changes
- lint or build for touched web slices
- manual testing only after automated checks relevant to the slice are green

9. Close with explicit completion criteria.
Report:
- what seam was changed
- which focused validations were run
- whether the repository rules were preserved: L0-first, no business logic leak into API, narrow edits

## Decision Rules

### Choose L0 when

- the behavior is domain logic, validation, transformation, filtering, pagination, or authorization logic independent of HTTP wiring
- a repository or dependency can be replaced with a small in-memory adapter
- the bug can be demonstrated without a real database or server

### Choose L1 when

- the behavior depends on endpoint contracts, routing, auth handlers, EF mappings, migrations, or real persistence behavior
- the important risk is in the seam between API and infrastructure rather than inside the domain module

### Step from API to Domain when

- the endpoint only maps request and response data
- the endpoint forwards to a service that actually decides the behavior
- you are about to add business rules into `volontiamo.api`

### Allow a non-test-first edit only when

- the code does not compile and a tiny reversible fix is needed before a test can run
- a missing type or broken fixture blocks the focused test
- the first edit is a probe specifically meant to expose the real failure surface

In those cases, make the smallest reversible edit possible and run the focused check immediately.

## Validation Order

1. Existing failing targeted test, if one exists
2. New targeted test for the touched behavior
3. Narrow compile, lint, or typecheck for the touched slice
4. Next-level seam validation only if warranted by the change
5. Manual verification only after relevant automated checks pass

## Quality Bar

The task is complete only when all of these are true:
- the changed behavior is covered at the lowest viable seam
- the first post-edit focused validation has been executed
- no new business logic was introduced into `volontiamo.api`
- tests use dedicated in-memory implementations for L0 where appropriate
- validation stayed narrow before broadening
- the final summary names both the code change and the checks that passed

## Anti-Patterns

- starting from broad repo exploration instead of a concrete anchor
- editing production code before choosing the lowest viable test seam
- jumping straight to L1 or manual testing for domain behavior
- using mocks in L0 where a simple in-memory adapter would be clearer
- adding decision logic to API endpoints that belongs in the domain module
- making multiple unrelated edits before rerunning focused validation

## Suggested Commands

Use repository-native commands and keep them as narrow as possible.

- Domain unit tests: `dotnet test .\\src\\volontiamo.domain.test.L0\\volontiamo.domain.test.L0.csproj --filter <TestName>`
- API integration tests: `dotnet test .\\src\\volontiamo.api.tests.L1\\volontiamo.api.tests.L1.csproj --filter <TestName>`
- API app run: `dotnet run --project .\\src\\volontiamo.api\\volontiamo.api.csproj`
- Manual bootstrap: `.\\start-manual-test.ps1`
- Web lint slice: run `npm run lint -- <files>` from `src/volontiamo.web/volontiamo`

## Expected Output

Produce:
- the chosen seam and why
- the selected test level and why lower levels were or were not sufficient
- the focused validation performed before and after the code change
- any justified escalation from L0 to L1 or from automated to manual testing