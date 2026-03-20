import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["src/index.ts", "src/svelte.ts", "src/svelte-store.ts"],
	target: "esnext",
	format: "esm",
	clean: true,
	dts: {
		resolve: true,
	},
})
