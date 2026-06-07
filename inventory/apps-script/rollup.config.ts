import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import cleanup from "rollup-plugin-cleanup";
import { defineConfig } from "rollup";

export default defineConfig({
  input: "src/WebApp.ts",
  output: {
    file: "dist/WebApp.js",
    // iife with name + extend:true puts everything on globalThis,
    // which means doPost/doGet are accessible as top-level globals in Apps Script
    format: "iife",
    name: "Inventory",
    extend: true,
    banner: "// Auto-generated — do not edit. Source: src/WebApp.ts",
  },
  plugins: [
    resolve(),
    typescript({ tsconfig: "./tsconfig.json" }),
    cleanup({ comments: "none" }),
  ],
});
