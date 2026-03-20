export const onError = Symbol("@terrygonguet/svelte-state-machine__onError")
export const onStateChange = Symbol("@terrygonguet/svelte-state-machine__onTransition")
export const onEnter = Symbol("@terrygonguet/svelte-state-machine__onEnter")
export const onExit = Symbol("@terrygonguet/svelte-state-machine__onExit")
export const onStay = Symbol("@terrygonguet/svelte-state-machine__onStay")

type MachineHookSymbols = typeof onError | typeof onStateChange
type MachineHooks<State extends { type: string }, Action extends { type: string }> = {
	[onError]: (state: State, action: Action, error: unknown) => State
	[onStateChange]: (prevState: State, curState: State, action: Action) => void
}

type StateHookSymbols = typeof onEnter | typeof onExit | typeof onStay
type StateHooks<State extends { type: string }, Action extends { type: string }, StateType extends State["type"]> = {
	[onEnter]: (prevState: State, curState: Extract<State, { type: StateType }>, action: Action) => void
	[onExit]: (curState: Extract<State, { type: StateType }>, nextState: State, action: Action) => void
	[onStay]: (
		prevState: Extract<State, { type: StateType }>,
		curState: Extract<State, { type: StateType }>,
		action: Action,
	) => void
}

type TransitionFn<
	State extends { type: string },
	Action extends { type: string },
	StateType extends State["type"],
	ActionType extends Action["type"],
> = (
	state: Extract<State, { type: StateType }>,
	action: Extract<Action, { type: ActionType }>,
) => State | AsyncGenerator<State, State, undefined>

export type MachineDefinition<State extends { type: string }, Action extends { type: string }> = {
	[StateType in State["type"] | MachineHookSymbols]?: StateType extends MachineHookSymbols
		? MachineHooks<State, Action>[StateType]
		: {
				[ActionType in Action["type"] | StateHookSymbols]?: ActionType extends StateHookSymbols
					? StateHooks<State, Action, Exclude<StateType, MachineHookSymbols>>[ActionType]
					: TransitionFn<
							State,
							Action,
							Exclude<StateType, MachineHookSymbols>,
							Exclude<ActionType, StateHookSymbols>
						>
			}
}

export type StateMachine<State extends { type: string }, Action extends { type: string }> = {
	state: State
	definition: MachineDefinition<State, Action>
	dispatch(action: Action): Promise<void>
}

export function stateMachine<State extends { type: string }, Action extends { type: string }>(
	initialState: State,
	machineDefinition: MachineDefinition<State, Action>,
): StateMachine<State, Action> {
	let activeGenerator: AsyncGenerator<State, State, never> | null = null

	const machine = {
		state: initialState,
		definition: machineDefinition,
		async dispatch(action: Action) {
			const stateType = this.state.type as State["type"]
			const actionType = action.type as Action["type"]
			const transitionFn = machineDefinition[stateType]?.[actionType]
			if (!transitionFn) return

			try {
				const nextOrGenerator = transitionFn(
					this.state as Extract<State, { type: string }>,
					action as Extract<Action, { type: string }>,
				)
				if ("type" in nextOrGenerator) {
					activeGenerator?.return(undefined as any)
					activeGenerator = null
					this._applyTransition(nextOrGenerator, action)
				} else {
					activeGenerator = nextOrGenerator
					while (true) {
						// TODO the generator can still throw even after being forcefully return()'d. how fix?
						const step = await nextOrGenerator.next()
						if (activeGenerator != nextOrGenerator) break
						if (step.value != undefined) this._applyTransition(step.value, action)
						if (step.done) break
					}
				}
			} catch (error) {
				if (machineDefinition[onError]) {
					const nextState = machineDefinition[onError](this.state, action, error)
					this._applyTransition(nextState, action)
				} else throw error
			}
		},
		_applyTransition(next: State, action: Action) {
			const curState = this.state as Extract<State, { type: string }>
			const nextState = next as Extract<State, { type: string }>
			const stateType = curState.type as State["type"]
			if (curState.type == nextState.type) {
				this.state = nextState
				machineDefinition[stateType]?.[onStay]?.(curState, nextState, action)
				machineDefinition[onStateChange]?.(curState, nextState, action)
			} else {
				machineDefinition[stateType]?.[onExit]?.(curState, nextState, action)
				this.state = nextState
				machineDefinition[nextState.type as State["type"]]?.[onEnter]?.(curState, nextState, action)
				machineDefinition[onStateChange]?.(curState, nextState, action)
			}
		},
	}

	return machine
}
