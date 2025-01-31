import { defineConfig } from "vite";
import path from "path";
import vitePluginRequire from "vite-plugin-require";

// https://vitejs.dev/config/
export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src")
		}
	},
	server: {
		host: true,
		hmr: true
	},
	build: {
		assetsDir: '.',
		outDir: 'export',
		minify: false,
		rollupOptions: {
			output: {
				entryFileNames: 'main.js',
			}
		},
		assetsInlineLimit: '0'
	},
	assetsInclude: ['**/*.glb'],
	output: {
		entryFileNames: 'main.js',
	},
	plugins: [
		vitePluginRequire.default(),
	],
});