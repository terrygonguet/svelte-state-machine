import { writable, type Readable } from "svelte/store"

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

export function stateMachine<
	State extends { type: string },
	Action extends { type: string },
>(
	initialState: State,
	machine: StateMachine<State, Action>,
): Readable<State> & { dispatch(action: Action): void } {
	let { subscribe, update, set } = writable(initialState)

	return {
		subscribe,
		dispatch(action: Action) {
			update(state => {
				let reducer =
					machine[state.type as State["type"]]?.[
						action.type as Action["type"]
					]
				let next = reducer?.(state, action) ?? state
				if (next instanceof Promise) {
					next.then(set)
					return state
				} else return next
			})
		},
	}
}
