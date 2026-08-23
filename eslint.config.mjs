import js from "@eslint/js"
import tseslint from "typescript-eslint"

/**
 * Correctness only. Formatting in this repository is done by hand and is
 * consistent, so no stylistic rules are enabled: a linter that argues about
 * brace placement gets switched off, and then it is not catching bugs either.
 */
export default tseslint.config(
	{
		ignores: ["dist/**", "coverage/**"]
	},

	js.configs.recommended,

	{
		files: ["**/*.ts", "**/*.mts"],
		extends: [tseslint.configs.recommended],
		rules: {
			// prefer-const is a style call, and this codebase has settled on let.
			"prefer-const": "off",
			"@typescript-eslint/no-unused-vars": ["error", {
				argsIgnorePattern: "^_",
				varsIgnorePattern: "^_"
			}]
		}
	},

	{
		// semantic-release's config, which it loads as CommonJS.
		files: ["**/*.js"],
		languageOptions: {
			sourceType: "commonjs",
			globals: {module: "writable", require: "readonly"}
		}
	},

	{
		files: ["**/*.mts", "**/*.mjs"],
		languageOptions: {
			globals: {console: "readonly", process: "readonly"}
		}
	}
)
