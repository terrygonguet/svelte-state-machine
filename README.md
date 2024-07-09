# @terrygonguet/svelte-state-machine

A utility package to create a fully typed
[state machine](https://www.baeldung.com/cs/state-machines) with associated data
as a [Svelte store](https://svelte.dev/docs/svelte-store).

## Installation

```bash
npm install @terrygonguet/svelte-pointerlock
```

## Example

```html
<script lang="ts">
	import { stateMachine } from "@terrygonguet/svelte-state-machine"

	type State = { type: "off" } | { type: "on"; extraBright: boolean }

	type Action = { type: "turnOn"; extraBright: boolean } | { type: "turnOff" }

	const { state, dispatch, is: { on: isOn } } = stateMachine<State, Action>({ type: "off" }, {
		off: {
			turnOn(state, action) {
				return { type: "on", extraBright: action.extraBright }
			}
		},
		on: {
			turnOff(state, action) {
				return { type: "off" }
			}
		}
	})
</script>

{#if $isOn}
	<!-- $state is of type { type: "off" } here -->
	<button on:click={() => dispatch({ type: "turnOn", extraBright: false })}>Turn on low</button>
	<button on:click={() => dispatch({ type: "turnOn", extraBright: true })}>Turn on high</button>
{:else}
	<!-- $state is of type { type: "on"; extraBright: boolean } here -->
	<button on:click={() => dispatch({ type: "turnOff" })}>Turn off</button>
{/if}
```

## Usage

This package only exports one function: `stateMachine(initialState, machine)`.

This function takes 2 type parameters `State` and `Action` that are both
intended to be
[discriminated unions](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions)
on the `type` property (e.g. `{ type: "off" } | { type: "on" }`).

The parameters are:

-   `initialState`: an initial value of type `State`
-   `machine`: the description of the state machine

The `machine` parameter is an object that specifies transition functions for
each state, for each action where the key is the `type` of the respective type:

```typescript
type State = { type: "stateA" } | { type: "stateB" }
type Action = { type: "actionA" } | { type: "actionB" }

const { state } = stateMachine<State, Action>({ type: "stateA" }, {
	stateA: {
		actionA: /* transition function */
	},
	stateB: { /* ... */ }
})
```

You can leave out any combination of state and action. This is useful when you
want to ignore some actions when in certain states.

Transition functions take 2 parameters: the current state and the current action
that was dispatched and should return the new state to transition to or a
promise that resolves to that state. When you return a promise the state machine
is locked until that promise resolves (any call to `dispatch` will be ignored).

The function returns an object with a few properties:

-   `state`: a [readable store](https://svelte.dev/docs/svelte-store#readable)
    containing the current state of the machine
-   `dispatch`: a function that takes an `Action` to transition the machine to a
    new state
-   `transitioning`: a readable store containing `true` when the machine doing
    an async transition and `false` otherwise
-   `is`: an object that maps every `State["type"]` to a readable store that
    contains `true` when the machine is in that state (the equivalent of
    `$state.type == "key"`)
