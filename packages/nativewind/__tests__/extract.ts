import { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

import nativePreset from "../src/tailwind";
import { Atom, AtomRecord } from "../src/transform-css/types";
import { extractStyles } from "./utilities";

/**
 * These tests are not really needed, and are more a sanity checker
 * that extraction is working as expected
 */

const expectStyle = (style: string, config?: Partial<Config>, css?: string) => {
  const createOptions = extractStyles(
    {
      content: [],
      safelist: style.split(" "),
      presets: [nativePreset],
      ...config,
    },
    `@tailwind components;@tailwind utilities;${css ?? ""}`
  );

  return expect(createOptions);
};

type OutputObject =
  | {
      css: string;
      config?: Partial<Config>;
      output: AtomRecord;
    }
  | {
      css?: string;
      config: Partial<Config>;
      output: AtomRecord;
    };

type CaseOutput = Atom | AtomRecord | OutputObject;

const cases: Record<string, CaseOutput> = {
  "text-white": {
    css: `:root { 
      --number: 255; 
      --string: string; 
      --unit: 123vw; 
      --rgb: rgb(255, 255, 255);
      --default-value: var(--value, 2);
      --rgb-var: rgb(255, 255, var(--number));
      --inline-theme-value: var(--error-color,platformColor(ios__systemRed,android__colorError,default__red));
      font-size: 16; 
      padding: 1px; 
    }`,
    output: {
      ":root": {
        variables: [
          {
            "--number": 255,
            "--string": "string",
            "--rem": 16,
            "--rgb": "rgb(255, 255, 255)",
            "--unit": {
              function: "vw",
              values: [123],
            },
            "--rgb-var": {
              function: "inbuilt",
              values: [
                "rgb",
                255,
                255,
                {
                  function: "var",
                  values: ["--number"],
                },
              ],
            },
            "--default-value": {
              function: "var",
              values: ["--value", 2],
            },
            "--inline-theme-value": {
              function: "var",
              values: [
                "--error-color",
                {
                  function: "platformColor",
                  values: [
                    "ios__systemRed",
                    "android__colorError",
                    "default__red",
                  ],
                },
              ],
            },
          },
        ],
      },
      "text-white": {
        styles: [{ color: "#fff" }],
      },
    },
  },
  "text-apply": {
    config: {
      plugins: [
        plugin(function ({ addUtilities }) {
          addUtilities({
            ".text-apply": {
              "@apply text-[black] dark:text-[white]": {},
            },
          });
        }),
      ],
    },
    output: {
      "text-apply": {
        styles: [{ color: "black" }, { color: "white" }],
        atRules: {
          1: [["prefers-color-scheme", "dark"]],
        },
        topics: ["--color-scheme"],
      },
    },
  },
  "text-media-query": {
    config: {
      plugins: [
        plugin(function ({ addUtilities }) {
          addUtilities({
            ".text-media-query": {
              color: "black",
            },
            "@media(prefers-color-scheme: dark)": {
              ".text-media-query": {
                color: "white",
              },
            },
          });
        }),
      ],
    },
    output: {
      "text-media-query": {
        styles: [{ color: "black" }, { color: "white" }],
        atRules: {
          1: [["prefers-color-scheme", "dark"]],
        },
        topics: ["--color-scheme"],
      },
    },
  },
  "gap-2": {
    "gap-2": {
      styles: [{ marginLeft: -8, marginTop: -8 }],
      childClasses: ["gap-2:children"],
    },
    "gap-2:children": {
      styles: [{ marginLeft: 8, marginTop: 8 }],
    },
  },
  "text-[color:hsl(var(--hue),var(--saturation),var(--lightness))]": {
    css: `:root { --hue: 255; }`,
    output: {
      ":root": {
        variables: [{ "--hue": 255 }],
      },
      "text-[color:hsl(var(--hue),var(--saturation),var(--lightness))]": {
        styles: [
          {
            color: {
              function: "inbuilt",
              values: [
                "hsl",
                { function: "var", values: ["--hue"] },
                { function: "var", values: ["--saturation"] },
                { function: "var", values: ["--lightness"] },
              ],
            },
          },
        ],
        topics: ["--hue", "--saturation", "--lightness"],
      },
    },
  },
  "dark:text-red-500": {
    styles: [{ color: "#ef4444" }],
    atRules: { 0: [["prefers-color-scheme", "dark"]] },
    topics: ["--color-scheme"],
  },
  "hover:text-red-500": {
    styles: [{ color: "#ef4444" }],
    conditions: ["hover"],
  },
  "shadow-sm": {
    atRules: {
      0: [["platform", "android"]],
      1: [["platform", "ios"]],
    },
    styles: [
      { elevation: 1.5, shadowColor: "black" },
      {
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        shadowColor: "rgba(0, 0, 0, 0.1)",
      },
    ],
  },
  container: {
    styles: [
      { width: "100%" },
      { maxWidth: 640 },
      { maxWidth: 768 },
      { maxWidth: 1024 },
      { maxWidth: 1280 },
      { maxWidth: 1536 },
    ],
    atRules: {
      1: [["min-width", 640]],
      2: [["min-width", 768]],
      3: [["min-width", 1024]],
      4: [["min-width", 1280]],
      5: [["min-width", 1536]],
    },
    topics: ["device-width"],
  },
};

test.each(Object.entries(cases))("%s", (input, output) => {
  if (isOutputObject(output)) {
    expectStyle(input, output.config, output.css).toEqual(output.output);
  } else if (isAtom(output)) {
    expectStyle(input).toEqual({
      [input]: output,
    });
  } else {
    expectStyle(input).toEqual(output);
  }
});

const isOutputObject = (output: CaseOutput): output is OutputObject => {
  return "output" in output;
};

const isAtom = (output: CaseOutput): output is Atom => "styles" in output;

// "dark:text-red-500": {
//   styles: [{ color: "#ef4444" }],
//   atRules: { 0: [["colorScheme", "dark"]] },
//   topics: ["colorScheme"],
// },
// "hover:text-red-500": {
//   styles: [{ color: "#ef4444" }],
//   conditions: ["hover"],
// },
// "dark:group-hover:hover:text-red-500": {
//   styles: [{ color: "#ef4444" }],
//   conditions: ["hover", "group-hover"],
//   topics: ["colorScheme"],
//   atRules: {
//     "0": [["colorScheme", "dark"]],
//   },
// },
// "scale-50": {
//   styles: [{ transform: [{ scaleY: 0.5 }, { scaleX: 0.5 }] }],
// },
// "group-hover:text-red-500": {
//   styles: [{ color: "#ef4444" }],
//   conditions: ["group-hover"],
// },
// "lg:hover:divide-x-2": {
//   "lg:hover:divide-x-2": {
//     styles: [{}],
//     conditions: ["hover", "parent"],
//     childClasses: ["lg:hover:divide-x-2.children"],
//     topics: ["width"],
//     atRules: {
//       0: [["media", "(min-width: 1024px)"]],
//     },
//   },
//   "lg:hover:divide-x-2.children": {
//     styles: [{ borderLeftWidth: 2, borderRightWidth: 0 }],
//     conditions: ["not-first-child"],
//     topics: ["width"],
//     atRules: {
//       0: [["media", "(min-width: 1024px)"]],
//     },
//   },
// },
// container: {
//   styles: [
//     { width: "100%" },
//     { maxWidth: 640 },
//     { maxWidth: 768 },
//     { maxWidth: 1024 },
//     { maxWidth: 1280 },
//     { maxWidth: 1536 },
//   ],
//   atRules: {
//     1: [["media", "(min-width: 640px)"]],
//     2: [["media", "(min-width: 768px)"]],
//     3: [["media", "(min-width: 1024px)"]],
//     4: [["media", "(min-width: 1280px)"]],
//     5: [["media", "(min-width: 1536px)"]],
//   },
//   topics: ["width"],
// },
