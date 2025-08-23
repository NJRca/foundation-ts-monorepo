# Mikado Method

The Mikado Method is a structured approach to making large-scale changes to complex codebases. It helps visualize dependencies and plan refactoring efforts systematically.

## Overview

The Mikado Method involves:
1. Setting a goal
2. Experimenting to understand prerequisites
3. Reverting changes that don't work
4. Building a dependency graph
5. Working bottom-up through prerequisites

## Basic Instructions

### 1. Define Your Goal
Start with a clear, specific goal for your refactoring:
- "Extract service X into a separate package"
- "Replace library Y with library Z"
- "Implement feature A"

### 2. Create a Mikado Graph
- Use a visual tool (whiteboard, diagram software, or text files)
- Start with your goal at the top
- Add prerequisites as you discover them

### 3. Experiment and Discover
For each change:
1. Try to implement it directly
2. Note what breaks or prevents the change
3. Revert the changes (keep the system working)
4. Add the prerequisites to your graph

### 4. Work Bottom-Up
- Identify leaf nodes (prerequisites with no dependencies)
- Implement these small, safe changes first
- Work your way up the dependency graph
- Keep the system working at each step

### 5. Example Mikado Graph

```
Goal: Extract User Service
├── Remove direct database calls from controllers
│   ├── Create UserRepository interface
│   ├── Implement database UserRepository
│   └── Update dependency injection
├── Extract user validation logic
│   ├── Create UserValidator class
│   └── Move validation rules
└── Create service interfaces
    ├── Define UserService interface
    └── Implement UserServiceImpl
```

## Best Practices

### Do:
- Keep changes small and atomic
- Always keep the system working
- Commit frequently at stable points
- Document your graph and progress
- Collaborate with team members

### Don't:
- Make multiple unrelated changes simultaneously
- Leave the system in a broken state
- Skip reverting failed experiments
- Rush through prerequisites

## Tools

### Visual Tools
- Whiteboards or sticky notes for team collaboration
- Miro, Lucidchart, or draw.io for digital graphs
- Text-based graphs in markdown files

### Version Control
- Use feature branches for experiments
- Tag stable points
- Use descriptive commit messages
- Create pull requests for each completed prerequisite

## Integration with This Codebase

### Planning Large Changes
1. Create a new file in `docs/mikado/` for each major refactoring
2. Name files descriptively: `extract-auth-service.md`, `migrate-to-typescript-5.md`
3. Document the goal, graph, and progress

### Example File Structure
```
docs/mikado/
├── README.md (this file)
├── extract-auth-service.md
├── upgrade-nodejs-version.md
└── implement-event-sourcing.md
```

### Tracking Progress
- Use checkboxes in markdown to track completed prerequisites
- Update ADRs when major architectural decisions are made
- Link related issues and pull requests

## Resources

- [Mikado Method Book](https://mikadomethod.wordpress.com/)
- [Visualizing Large Refactorings](https://www.infoq.com/articles/mikado-method/)
- [Refactoring at Scale](https://www.martinfowler.com/articles/workflowsOfRefactoring/)

Remember: The Mikado Method is about making complex changes manageable through systematic planning and small, safe steps.