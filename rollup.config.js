import { rollupPluginHTML as html } from "@web/rollup-plugin-html";
import terser from "@rollup/plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "src/index.html",
  output: {
    dir: "dist",
    plugins: [terser()],
  },
  plugins: [
    html({
      minify: true,
    }),
    nodeResolve(),
  ],
};
