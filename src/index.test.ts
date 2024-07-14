import { describe, expect, test, vi } from "vitest"
import { stateMachine, type StateMachine } from "./index.js"
import { get } from "svelte/store"

function delay(ms: number) {
	return new Promise(res => setTimeout(res, ms))
}

namespace Sync {
	export type State = { type: "on"; level: number } | { type: "off" }
	export type Action = { type: "toggle" } | { type: "up" } | { type: "down" }

	export const machine: StateMachine<State, Action> = {
		off: {
			toggle() {
				return { type: "on", level: 1 }
			},
			up() {
				return { type: "on", level: 1 }
			},
		},
		on: {
			toggle() {
				return { type: "off" }
			},
			up(state) {
				if (state.level >= 3) return state
				else return { type: "on", level: state.level + 1 }
			},
			down(state) {
				if (state.level == 1) return { type: "off" }
				else return { type: "on", level: state.level - 1 }
			},
		},
	}
}

describe("Sync transitions", { concurrent: true }, () => {
	test("The machine starts with the specified initial state", () => {
		const { state } = stateMachine<Sync.State, Sync.Action>(
			{ type: "off" },
			Sync.machine,
		)
		expect(get(state)).toEqual({ type: "off" })
	})

	test("The machine transitions to a new state with attached properties", () => {
		const { state, dispatch } = stateMachine<Sync.State, Sync.Action>(
			{ type: "off" },
			Sync.machine,
		)
		expect(get(state)).toEqual({ type: "off" })
		dispatch({ type: "toggle" })
		expect(get(state)).toEqual({ type: "on", level: 1 })
	})

	test("The machine ignores actions when a transition wasn't specified", () => {
		const { state, dispatch } = stateMachine<Sync.State, Sync.Action>(
			{ type: "off" },
			Sync.machine,
		)
		expect(get(state)).toEqual({ type: "off" })
		dispatch({ type: "down" })
		expect(get(state)).toEqual({ type: "off" })
	})

	test("The returned 'is' stores are correct", () => {
		const { dispatch, is } = stateMachine<Sync.State, Sync.Action>(
			{ type: "off" },
			Sync.machine,
		)
		expect(get(is.off)).toBe(true)
		expect(get(is.on)).toBe(false)
		dispatch({ type: "toggle" })
		expect(get(is.off)).toBe(false)
		expect(get(is.on)).toBe(true)
	})

	test("The 'transitioning' store stays off during a sync transition", () => {
		const { dispatch, transitioning } = stateMachine<
			Sync.State,
			Sync.Action
		>({ type: "off" }, Sync.machine)
		const verboten = vi.fn()
		transitioning.subscribe(verboten)
		expect(verboten).toHaveBeenCalledOnce()
		dispatch({ type: "toggle" })
		expect(verboten).toHaveBeenCalledOnce()
	})

	test("The machine can catch errors", () => {
		const { state, dispatch } = stateMachine<
			{ type: "initial" } | { type: "error"; error: unknown },
			{ type: "fail" }
		>(
			{ type: "initial" },
			{
				onError: error => ({ type: "error", error }),
			},
			{
				initial: {
					fail() {
						throw "fail"
					},
				},
			},
		)
		dispatch({ type: "fail" })
		expect(get(state)).toEqual({ type: "error", error: "fail" })
	})
})

describe("Async transitions", { concurrent: true }, () => {
	type State =
		| { type: "initial" }
		| { type: "loading" }
		| { type: "result"; data: number }
		| { type: "error"; error: unknown }
	type Action = { type: "doRequest" }

	test("The 'transitioning' store is true during an async transition", async () => {
		const { dispatch, transitioning } = stateMachine<State, Action>(
			{ type: "initial" },
			{
				initial: {
					async doRequest() {
						await delay(100)
						return { type: "result", data: 5 }
					},
				},
			},
		)
		expect(get(transitioning)).toBe(false)
		dispatch({ type: "doRequest" })
		expect(get(transitioning)).toBe(true)
		await delay(100)
		expect(get(transitioning)).toBe(false)
	})

	test("The machine moves to a loading state during an async transition", async () => {
		const { state, dispatch, transitioning } = stateMachine<State, Action>(
			{ type: "initial" },
			{ async: () => ({ type: "loading" }) },
			{
				initial: {
					async doRequest(state, action) {
						await delay(100)
						return { type: "result", data: 5 }
					},
				},
			},
		)
		expect(get(state)).toEqual({ type: "initial" })
		dispatch({ type: "doRequest" })
		expect(get(state)).toEqual({ type: "loading" })
		expect(get(transitioning)).toBe(true)
		await delay(100)
		expect(get(state)).toEqual({ type: "result", data: 5 })
		expect(get(transitioning)).toBe(false)
	})

	test("The machine ignores multiple actions in 'block' async mode", async () => {
		const { state, dispatch } = stateMachine<State, Action>(
			{ type: "initial" },
			{ async: "block" },
			{
				initial: {
					async doRequest(state, action) {
						await delay(100)
						return { type: "result", data: 5 }
					},
				},
			},
		)
		dispatch({ type: "doRequest" })
		expect(get(state)).toEqual({ type: "initial" })
		await delay(10)
		dispatch({ type: "doRequest" })
		expect(get(state)).toEqual({ type: "initial" })
		await delay(90)
		expect(get(state)).toEqual({ type: "result", data: 5 })
	})

	test("The machine aborts transition in 'abort' async mode", async () => {
		const { state, dispatch, transitioning } = stateMachine<State, Action>(
			{ type: "initial" },
			{ async: "abort" },
			{
				initial: {
					async doRequest() {
						await delay(100)
						return { type: "result", data: 5 }
					},
				},
			},
		)

		dispatch({ type: "doRequest" })
		expect(get(transitioning)).toBe(true)
		expect(get(state)).toEqual({ type: "initial" })

		await delay(50)
		dispatch({ type: "doRequest" }) // restart transition
		expect(get(transitioning)).toBe(true)
		expect(get(state)).toEqual({ type: "initial" })

		await delay(50)
		expect(get(transitioning)).toBe(true)
		expect(get(state)).toEqual({ type: "initial" })

		await delay(50)
		expect(get(transitioning)).toBe(false)
		expect(get(state)).toEqual({ type: "result", data: 5 })
	})

	test("The machine can catch async errors", async () => {
		const { state, dispatch } = stateMachine<State, Action>(
			{ type: "initial" },
			{
				async: () => ({ type: "loading" }),
				onError: error => ({ type: "error", error }),
			},
			{
				initial: {
					async doRequest() {
						await delay(100)
						throw "fail"
					},
				},
			},
		)
		dispatch({ type: "doRequest" })
		expect(get(state)).toEqual({ type: "loading" })
		await delay(100)
		expect(get(state)).toEqual({ type: "error", error: "fail" })
	})
})
