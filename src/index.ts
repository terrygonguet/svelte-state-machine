import { writable, readonly, type Readable, derived } from "svelte/store"

type StateMachine<
	State extends { type: string },
	Action extends { type: string },
> = {
	[StateType in State["type"]]?: {
		[ActionType in Action["type"]]?: <
			CurState extends State & { type: StateType },
			CurAction extends Action & { type: ActionType },
		>(
			state: CurState,
			action: CurAction,
		) => State | Promise<State>
	}
}

type Is<State extends { type: string }> = {
	[StateType in State["type"]]: Readable<boolean>
}

export function stateMachine<
	State extends { type: string },
	Action extends { type: string },
>(
	initialState: State,
	machine: StateMachine<State, Action>,
): {
	state: Readable<State>
	dispatch(action: Action): void
	transitioning: Readable<boolean>
	is: Is<State>
} {
	let state = writable(initialState)

	let transitioning = writable(false)
	let isLocked = false
	transitioning.subscribe(value => (isLocked = value))

	function dispatch($action: Action) {
		if (isLocked) return
		state.update($state => {
			let reducer =
				machine[$state.type as State["type"]]?.[
					$action.type as Action["type"]
				]
			let next = reducer?.($state, $action) ?? $state
			if (next instanceof Promise) {
				transitioning.set(true)
				next.then(
					newState => {
						state.set(newState)
						transitioning.set(false)
					},
					() => transitioning.set(false),
				)
				return $state
			} else return next
		})
	}

	let is = Object.fromEntries(
		Object.keys(machine).map(type => [
			type,
			derived(state, $state => $state.type == type),
		]),
	) as Is<State>

	return {
		state: readonly(state),
		transitioning: readonly(transitioning),
		dispatch,
		is,
	}
}
