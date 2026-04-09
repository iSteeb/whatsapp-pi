<!--
Sync Impact Report:
- Version change: [CONSTITUTION_VERSION] → 1.0.0
- List of modified principles:
    - [PRINCIPLE_1_NAME] → I. Object Oriented Programming (OOP)
    - [PRINCIPLE_2_NAME] → II. Clean Code
    - [PRINCIPLE_3_NAME] → III. SOLID Principles
    - [PRINCIPLE_4_NAME] → IV. TypeScript Excellence
    - [PRINCIPLE_5_NAME] → V. Simplicity
- Added sections:
    - Technical Constraints & Stack
    - Development Workflow
- Removed sections: None
- Templates requiring updates:
    - ✅ .specify/templates/plan-template.md
- Follow-up TODOs: None
-->

# whatsapp-pi Constitution

## Core Principles

### I. Object Oriented Programming (OOP)
The codebase MUST follow Object Oriented Programming principles. Use classes, interfaces, and design patterns
appropriately to manage complexity and ensure modularity.

### II. Clean Code
Adhere to Clean Code practices. Names must be meaningful, functions must be small and do one thing,
and the code MUST be readable and maintainable.

### III. SOLID Principles
All code MUST strictly follow SOLID principles (Single Responsibility, Open/Closed, Liskov Substitution,
Interface Segregation, and Dependency Inversion) to ensure a robust and flexible architecture.

### IV. TypeScript Excellence
Leverage TypeScript's type system to its fullest. Avoid `any`, use strict typing, and prefer interfaces
for defining contracts between components.

### V. Simplicity
Keep the implementation as simple as possible. Avoid over-engineering. Follow YAGNI (You Ain't Gonna Need It)
and KISS (Keep It Simple, Stupid) principles.

## Technical Constraints & Stack

The project is a Pi Code Agent extension. It MUST integrate seamlessly with the Pi ecosystem.
It uses the Baileys library for WhatsApp connectivity. All asynchronous operations MUST be handled
using Promises/async/await.

## Development Workflow

Every change MUST be documented in the corresponding specification and plan files. Tasks MUST be
derived from the plan. Code reviews MUST ensure adherence to these constitutional principles.

## Governance

This constitution is the primary authority for project decisions. Amendments require a version bump.
All development artifacts (specs, plans, tasks) MUST align with these principles.
Use `.specify/memory/constitution.md` as the source of truth.

1. Amendments require a MINOR or MAJOR version bump.
2. All code reviews MUST check against these 5 principles.
3. Any deviation MUST be documented in the "Complexity Tracking" section of the plan.

**Version**: 1.0.0 | **Ratified**: 2026-04-09 | **Last Amended**: 2026-04-09
