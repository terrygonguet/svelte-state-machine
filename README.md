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

	const { state, dispatch } = stateMachine<State, Action>({ type: "off" }, {
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

{#if $state.type == "on"}
	<!-- $state is of type { type: "off" } here -->
	<button on:click={() => dispatch({ type: "turnOn", extraBright: false })}>Turn on low</button>
	<button on:click={() => dispatch({ type: "turnOn", extraBright: true })}>Turn on high</button>
{:else}
	<!-- $state is of type { type: "on"; extraBright: boolean } here -->
	<button on:click={() => dispatch({ type: "turnOff" })}>Turn off</button>
{/if}
```

## Usage

This package exports one function: `stateMachine` and is used like:

```typescript
const { state, dispatch, transitioning, is } = stateMachine<State, Action>(
	initialState,
	options,
	machine,
)
// OR, with default options:
const { state, dispatch, transitioning, is } = stateMachine<State, Action>(
	initialState,
	machine,
)
```

This function takes 2 type parameters `State` and `Action` that are both
intended to be
[discriminated unions](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions)
on the `type` property (e.g. `{ type: "off" } | { type: "on" }`).

The parameters are:

-   `initialState`: an initial value of type `State`
-   `options` (optional): an options object
    -   `asyncMode` (default: `"block"`): wether to `"block"` (ignore new
        actions) or `"abort"` (cancel current async transition to replace it)
        when in an async transition
    -   `onError` (default: no op): a function that gets called when an error is
        trown during a transition function and allows you to recover by
        returning a new state object
    -   `hooks`: an object specifying functions for every state to be called
        during transition flow
-   `machine`: the description of the state machine

### The `machine` object

The `machine` parameter is an object that specifies transition functions for
each state, for each action where the key is the `type` of the respective type:

```typescript
type State = { type: "stateA" } | { type: "stateB" }
type Action = { type: "actionA" } | { type: "actionB" }

const { state } = stateMachine<State, Action>({ type: "stateA" }, {
	stateA: {
		actionA: /* transition function */
		// no action on actionB action
	},
	// we can leave out stateB entirely
})
```

You can leave out any combination of state and action. This is useful when you
want to ignore some actions when in certain states.

### Transition functions

Transition functions take 2 parameters: the current state and the current action
that was dispatched and should return the new state to transition to or a
promise that resolves to that state. The types of the parameters are
automatically narrowed to reduce boilerplate:

```typescript
type State = { type: "stateA" } | { type: "stateB" }
type Action = { type: "actionA" } | { type: "actionB" }

stateMachine<State, Action>(
	{ type: "stateA" },
	{
		stateA: {
			actionA(state, action) {
				// state is narrowed to { type: "stateA" }
				// action is narrowed to { type: "actionA" }
			},
		},
	},
)
```

### Async transtion funtions

Transition functions can return promises. In that case the state machine will
wait for the promise to resolve and transition to the new state then. While the
promise is pending the `transitioning` store contains `true`.

The behaviour of the state machine while an async transition is pending is
controlled by the `asyncMode` option and defaults to `"block"`:

-   `"block"`: any new actions dispatched will be ignored until the transition
    resolves
-   `"abort"`: the current transition is aborted and replaced with the new one

### Hooks

You can specify `hooks` to be called during transitions flow, scoped by state
type:

```typescript
type State = { type: "stateA" } | { type: "stateB" }

const hooks = {
	stateA: {
		onEnter(prevState, curState, action) {}
		onExit(prevState, nextState, action) {}
		onAsyncTransition(state, action) {}
	},
	// more hooks for other states
}
```

-   `onEnter`: called just before the state machine transitions to the specified
    state
-   `onExit`: called just before the machine transitions away from the specified
    state
-   `onAsyncTransition`: a function called when an async transition starts; can
    return a new state object to be transitioned to while the async tranition is
    pending

### Returned object

The `stateMachine` function returns an object with a few properties:

-   `state`: a [readable store](https://svelte.dev/docs/svelte-store#readable)
    containing the current state of the machine
-   `dispatch`: a function that takes an `Action` to transition the machine to a
    new state
-   `transitioning`: a readable store containing `true` when the machine doing
    an async transition and `false` otherwise
-   `is`: an object that maps every `State["type"]` to a readable store that
    contains `true` when the machine is in that state (the equivalent of
    `$state.type == "key"`)
