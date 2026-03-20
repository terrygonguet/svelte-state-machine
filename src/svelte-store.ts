import { readonly, writable, type Readable } from "svelte/store"
import {
	stateMachine as baseStateMachine,
	type MachineDefinition,
	type StateMachine as BaseStateMachine,
} from "./index.js"

export { onError, onStateChange, onEnter, onExit, onStay, type MachineDefinition } from "./index.js"

export type StateMachine<State extends { type: string }, Action extends { type: string }> = BaseStateMachine<
	State,
	Action
> & {
	store: Readable<State>
}

export function stateMachine<State extends { type: string }, Action extends { type: string }>(
	initialState: State,
	machineDefinition: MachineDefinition<State, Action>,
): StateMachine<State, Action> {
	const baseMachine = baseStateMachine<State, Action>(initialState, machineDefinition)

	const store = writable(initialState)
	const machine = {
		...baseMachine,
		store: readonly(store),
		get state() {
			return baseMachine.state
		},
		set state(next) {
			baseMachine.state = next
			store.set(next)
		},
	}

	// HACK force bind to the inner machine so we can destructure the returned object
	machine.dispatch = baseMachine.dispatch.bind(machine)

	return machine
}
