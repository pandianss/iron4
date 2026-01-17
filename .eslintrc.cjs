module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: [
        "@typescript-eslint",
        "boundaries",
        "import"
    ],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],

    settings: {
        "boundaries/elements": [
            { "type": "shared", "pattern": "shared/*" },
            { "type": "core", "pattern": "core/*" },
            { "type": "governance", "pattern": "governance/*" },
            { "type": "engine", "pattern": "engine/*" },
            { "type": "audit", "pattern": "audit/*" },
            { "type": "application", "pattern": "application/*" },
            { "type": "infra", "pattern": "infra/*" },
            { "type": "ui", "pattern": "ui/*" }
        ]
    },

    rules: {
        /* -------------------------------------------
           HARD BOUNDARY ENFORCEMENT
        -------------------------------------------- */

        "boundaries/element-types": [2, {
            "default": "disallow",
            "rules": [
                /* shared */
                { "from": "shared", "allow": ["shared"] },

                /* core */
                { "from": "core", "allow": ["shared"] },

                /* governance */
                { "from": "governance", "allow": ["shared", "core"] },

                /* engine */
                { "from": "engine", "allow": ["shared", "core", "governance"] },

                /* audit */
                { "from": "audit", "allow": ["shared", "core"] },

                /* application */
                {
                    "from": "application",
                    "allow": [
                        "shared",
                        "core",
                        "governance",
                        "engine",
                        "audit",
                        "infra"
                    ]
                },

                /* infra */
                {
                    "from": "infra",
                    "allow": ["shared"]
                },

                /* ui */
                {
                    "from": "ui",
                    "allow": ["shared", "application"]
                }
            ]
        }],

        /* -------------------------------------------
           IMPORT DISCIPLINE
        -------------------------------------------- */

        "import/no-relative-parent-imports": "error",
        "import/no-cycle": ["error", { "maxDepth": 1 }],
        "import/no-self-import": "error",

        /* -------------------------------------------
           TYPE SAFETY
        -------------------------------------------- */

        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],

        /* -------------------------------------------
           DOMAIN SAFETY
        -------------------------------------------- */

        "no-console": "error",
        "no-restricted-globals": ["error", "Date", "Math"],

        /* -------------------------------------------
           ESCAPE HATCH (VERY LIMITED)
        -------------------------------------------- */

        "boundaries/no-unknown": "error"
    },

    overrides: [
        {
            files: ["src/ui/**/*"],
            rules: {
                "no-console": "off"
            }
        }
    ]
}
