# Demo edge plan — graph-derived groups

**Goal:** a canonical new-shape plan whose `- **DependsOn**:` edge declarations drive the
TaskGraph grouping derivation: task 2 depends on task 1, task 3 depends on task 2.

### Task 1: root

- **Objective**: the root task of the edge plan
- **Files**: packages/cdd-engine/src/documents/doctypes/body/root.ts
- **Consumes**: - none -
- **Produces**: root output
- **DependsOn**: none
- **Steps**:
  1. implement the root — checkable: done
- **Acceptance**:
  - the root task is implemented

### Task 2: depends on task 1

- **Objective**: the second task of the edge plan
- **DependsOn**: 1
- **Steps**:
  1. implement the dependent — checkable: done
- **Acceptance**:
  - the dependent task is implemented

### Task 3: depends on task 2

- **Objective**: the third task of the edge plan
- **DependsOn**: 2
- **Steps**:
  1. implement the tail — checkable: done
- **Acceptance**:
  - the tail task is implemented
