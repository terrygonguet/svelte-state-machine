import { createSubscriber } from "svelte/reactivity"
import { stateMachine as baseStateMachine, type MachineDefinition, type StateMachine } from "./index.js"

export { onError, onStateChange, onEnter, onExit, onStay, type MachineDefinition, type StateMachine } from "./index.js"

export function stateMachine<State extends { type: string }, Action extends { type: string }>(
	initialState: State,
	machineDefinition: MachineDefinition<State, Action>,
): StateMachine<State, Action> {
	const machine = baseStateMachine<State, Action>(initialState, machineDefinition)

	let update = () => {}
	const subscribe = createSubscriber(updater => void (update = updater))

	let _state: State = initialState
	return {
		...machine,
		get state() {
			subscribe()
			return _state
		},
		set state(next) {
			_state = next
			update()
		},
	}
}
