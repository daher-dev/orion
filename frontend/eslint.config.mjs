import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // shadcn-generated primitives in src/components/ui/** sometimes use
  // patterns that the new react-hooks rules flag (e.g. Math.random for the
  // sidebar skeleton width). We treat that directory as third-party code.
  {
    files: ["src/components/ui/**"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  // TanStack Table (`useReactTable`, in *Table.tsx) and React Hook Form
  // (`useForm`, in *Form.tsx) are not compatible with the React Compiler: it
  // safely *skips* optimizing components that use them (a missed-memoization,
  // not a correctness issue). That makes `incompatible-library` a permanent,
  // non-actionable "Compilation Skipped" warning for every table/form. Silence
  // it for those files only — the rule stays on elsewhere, so a genuinely new
  // incompatible dependency still surfaces.
  {
    files: ["src/components/**/*Table.tsx", "src/components/**/*Form.tsx"],
    rules: {
      "react-hooks/incompatible-library": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
