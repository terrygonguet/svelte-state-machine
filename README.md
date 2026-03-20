# @terrygonguet/svelte-state-machine

A utility package to create a fully typed [state machine](https://www.baeldung.com/cs/state-machines) with associated
data. With special [Svelte](https://svelte.dev/docs) utils.

## Installation

```bash
npm install @terrygonguet/state-machine
```

## Why?

I wanted a state machine library that:

- is as concise as possible
- defines its transitions via code
- can carry additional fully typed data along states and actions
- can handle async transition
- (ideally) seamlessly integrates with Svelte & friends

## Example

```svelte
<script lang="ts">
	import { stateMachine } from "@terrygonguet/state-machine/svelte"

	type State = { type: "off" } | { type: "on"; extraBright: boolean }
	type Action = { type: "turnOn"; extraBright: boolean } | { type: "turnOff" }

	const machine = stateMachine<State, Action>(
		{ type: "off" },
		{
			off: {
				async *turnOn(state, action) {
					yield { type: "on", extraBright: action.extraBright }
					await pause(10_000)
					return { type: "off" }
				},
			},
			on: {
				turnOff(state, action) {
					return { type: "off" }
				},
			},
		},
	)
</script>

{#if machine.state.type == "on"}
	<!-- state is of type { type: "off" } here -->
	<button onclick={() =>machine.dispatch({ type: "turnOn", extraBright: false })}>Turn on low</button>
	<button onclick={() =>machine.dispatch({ type: "turnOn", extraBright: true })}>Turn on high</button>
{:else}
	<!-- state is of type { type: "on"; extraBright: boolean } here -->
	<button onclick={() =>machine.dispatch({ type: "turnOff" })}>Turn off</button>
{/if}
```

## Usage

This package exports one function: `stateMachine` and is used like:

```typescript
const machine = stateMachine<State, Action>(initialState, machineDefinition)
```

This function takes 2 type parameters `State` and `Action` that are both intended to be
[discriminated unions](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions)
on the `type` property (e.g. `{ type: "off" } | { type: "on" }`).

The parameters are:

- `initialState`: an initial value of type `State`
- `machineDefinition`: the description of the state machine

### The `machineDefinition` object

The `machineDefinition` parameter is an object that specifies transition functions for each state, for each action where
the key is the `type` of the respective type:

```typescript
type State = { type: "stateA" } | { type: "stateB" } | { type: "stateC" }
type Action = { type: "actionA" } | { type: "actionB" }

const machine = stateMachine<State, Action>({ type: "stateA" }, {
	stateA: {
		actionA: // transition function
		actionB: // transition function
	},
	stateB: {
		actionA: // transition function
		// no action on actionB action
	},
	// we can leave out stateC entirely
})
```

You can leave out any combination of state and action. This is useful when you want to ignore some actions when in
certain states.

### Transition functions

Transition functions take 2 parameters: the current state and the current action that was dispatched and should return
the new state to transition to or a promise that resolves to that state. The types of the parameters are automatically
narrowed to reduce boilerplate:

```typescript
type State = { type: "stateA"; someData: number } | { type: "stateB" }
type Action = { type: "actionA"; otherData: string } | { type: "actionB" }

stateMachine<State, Action>(
	{ type: "stateA", someData: 5 },
	{
		stateA: {
			actionA(state, action) {
				// state is narrowed to { type: "stateA", someData: number }
				// action is narrowed to { type: "actionA", otherData: string }
			},
		},
	},
)
```

### Async transtion funtions

Transition functions can be
[Async Generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*). In
that case the state machine will transition to the states yielded or returned by the generator.

If a new transition happens before the generator completes, its execution is halted and the machine transitions
according to the new transition as usual.

### Hooks

You can specify hooks to be called during transitions flow, some scoped by state, some global to the machine. You
specifiy them like normal transitions but using the special
[Symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol) exported by the
package:

```typescript
import { onEnter, onExit, onStay, onError, onStateChange } from "@terrygonguet/state-machine"

type State = { type: "stateA" } | { type: "stateB" }

const machineDefinition = {
	[onError](state, action, error) {},
	[onStateChange](prevState, curState, action) {},
	stateA: {
		[onEnter](prevState, curState, action) {},
		[onExit](prevState, nextState, action) {},
		[onStay](prevState, nextState, action) {},
	},
	// more hooks for other states
}
```

- `onError`: called when an error occurs in a transition function or another hook. **Must return a new state to
  transition to.**
- `onStateChange`: called after _every_ state change
- `onEnter`: called just after the state machine transitions to the specified state
- `onExit`: called just before the machine transitions away from the specified state
- `onStay`: called after the machine ran a transition but stayed in the same state

### Returned object

The `stateMachine` function returns an object with a few properties:

- `state`: the current state of the machine
- `dispatch`: a function that takes an `Action` to transition the machine to a new state
- `machineDefinition`: the object used to create the machine. Mutate it at your own risks

## Svelte

The package exposes 2 Svelte specific implementations of the state machine that behave identically but make the state
reactive.

- `@terrygonguet/state-machine/svelte` makes the `machine.state` property reactive for Svelte 5
- `@terrygonguet/state-machine/svelte-store` adds a `machine.store` property that is a `Readable<State>` store

```ts
import { stateMachine } from "@terrygonguet/state-machine/svelte-store"

const { store, dispatch } = stateMachine<State, Action>({ type: "initial" }, { ... })

// $store is the machine's state
```
