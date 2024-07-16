import { writable, readonly, type Readable, derived } from "svelte/store"

export type StateMachine<
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

type StateMachineOptions<
	State extends { type: string },
	Action extends { type: string },
> = {
	asyncMode?: "block" | "abort"
	onError?: (error: unknown, state: State, action: Action) => State
	hooks?: {
		[StateType in State["type"]]?: {
			onEnter?: <CurState extends State & { type: StateType }>(
				prevState: State,
				curState: CurState,
				action: Action,
			) => void
			onExit?: <PrevState extends State & { type: StateType }>(
				prevState: PrevState,
				nextState: State,
				action: Action,
			) => void
			onAsyncTransition?: <CurState extends State & { type: StateType }>(
				state: CurState,
				action: Action,
			) => State | undefined
		}
	}
}

type StateMachineBundle<
	State extends { type: string },
	Action extends { type: string },
> = {
	state: Readable<State>
	dispatch(action: Action): void
	transitioning: Readable<boolean>
	is: Is<State>
}

export function stateMachine<
	State extends { type: string },
	Action extends { type: string },
>(
	initialState: State,
	machine: StateMachine<State, Action>,
): StateMachineBundle<State, Action>
export function stateMachine<
	State extends { type: string },
	Action extends { type: string },
>(
	initialState: State,
	options: StateMachineOptions<State, Action>,
	machine: StateMachine<State, Action>,
): StateMachineBundle<State, Action>
export function stateMachine<
	State extends { type: string },
	Action extends { type: string },
>(
	initialState: State,
	machineOrOptions:
		| StateMachineOptions<State, Action>
		| StateMachine<State, Action>,
	maybeMachine?: StateMachine<State, Action>,
) {
	if (maybeMachine)
		return _stateMachine(initialState, machineOrOptions, maybeMachine)
	else
		return _stateMachine(
			initialState,
			{},
			machineOrOptions as StateMachine<State, Action>,
		)
}

function _stateMachine<
	State extends { type: string },
	Action extends { type: string },
>(
	initialState: State,
	{ asyncMode = "block", onError, hooks }: StateMachineOptions<State, Action>,
	machine: StateMachine<State, Action>,
): StateMachineBundle<State, Action> {
	let state = writable(initialState)

	let transitioning = writable(false)
	let $transitioning = false
	transitioning.subscribe(value => ($transitioning = value))

	let abortController: AbortController | undefined = undefined

	function dispatch($action: Action) {
		if ($transitioning) {
			switch (asyncMode) {
				case "abort":
					abortController?.abort()
					break
				case "block":
					return
			}
		}

		state.update($state => {
			let stateType = $state.type as State["type"]
			let actionType = $action.type as Action["type"]
			let reducer = machine[stateType]?.[actionType]
			let { onExit, onAsyncTransition } = hooks?.[stateType] ?? {}

			try {
				let next = reducer?.($state, $action) ?? $state
				if (next instanceof Promise) {
					transitioning.set(true)

					let loadingState = onAsyncTransition?.($state, $action)

					if (asyncMode == "abort") {
						abortController = new AbortController()
						next = abortable(next, abortController.signal)
					}

					next.then(
						next => {
							onExit?.($state, next, $action)
							let nextType = next.type as State["type"]
							const { onEnter } = hooks?.[nextType] ?? {}
							onEnter?.($state, next, $action)
							state.set(next)
							transitioning.set(false)
						},
						error => {
							if (isAbortError(error)) return
							transitioning.set(false)
							if (onError)
								state.set(onError(error, $state, $action))
							else throw error
						},
					)

					return loadingState ?? $state
				} else {
					onExit?.($state, next, $action)
					let nextType = next.type as State["type"]
					const { onEnter } = hooks?.[nextType] ?? {}
					onEnter?.($state, next, $action)
					return next
				}
			} catch (error) {
				if (onError) return onError(error, $state, $action)
				else throw error
			}
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

/**
 * From https://jsr.io/@std/async/0.224.2/abortable.ts
 */
function abortable<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
	if (signal.aborted) {
		return Promise.reject(new DOMException(signal.reason, "AbortError"))
	}
	let reject: (reason: unknown) => void
	const promise = new Promise<never>((res, rej) => (reject = rej))
	const abort = () => reject(new DOMException(signal.reason, "AbortError"))
	signal.addEventListener("abort", abort, { once: true })
	return Promise.race([promise, p]).finally(() => {
		signal.removeEventListener("abort", abort)
	})
}

function isAbortError(error: unknown): error is DOMException {
	return error instanceof DOMException && error.name == "AbortError"
}
