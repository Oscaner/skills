# Forward edge plan — anti-dependency BLOCK fixture

**Goal:** a canonical new-shape plan whose `- **DependsOn**:` declarations trip the anti-dependency
gate: task 5 depends on the higher-numbered task 10 — a forward reference (numbering order is the
topological-linearization anchor; a `DependsOn` may only point at a lower-numbered task). The plan
validates BLOCK with the `contradiction` verdict class (and fires the structure rule
`plan.antiDependency` at the doc-contract gate).

**Spec:** [forward-edge-design.md](docs/kairos/specs/forward-edge-design.md)

## Constraints

- the anti-dependency fixture's own delta

### Task 1: root a

- **Objective**: task one
- **DependsOn**: none
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done

### Task 2: root b

- **Objective**: task two
- **DependsOn**: none
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done

### Task 3: root c

- **Objective**: task three
- **DependsOn**: none
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done

### Task 4: root d

- **Objective**: task four
- **DependsOn**: none
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done

### Task 5: forward dependency

- **Objective**: the forward-dependency task — depends on the higher-numbered task 10
- **DependsOn**: 10
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done

### Task 6: root e

- **Objective**: task six
- **DependsOn**: none
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done

### Task 7: root f

- **Objective**: task seven
- **DependsOn**: none
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done

### Task 8: root g

- **Objective**: task eight
- **DependsOn**: none
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done

### Task 9: root h

- **Objective**: task nine
- **DependsOn**: none
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done

### Task 10: root i

- **Objective**: task ten
- **DependsOn**: none
- **Steps**:
  1. implement — checkable: done
- **Acceptance**:
  - done
