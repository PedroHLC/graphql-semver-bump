# graphql-semver-bump

### What?

Deno script that diff two git-references of a GraphQL-schema-file and suggests bumps to a JSON-stored semver version.

### How to run?

```sh
deno run --allow-run=git \
    'https://raw.githubusercontent.com/PedroHLC/graphql-semver-bump/main/index.ts'  \
    "$GITHUB_BASE_REF" \
    "$GITHUB_HEAD_REF" \
    'graphql/my-project/schema.graphql' \
    'graphql/my-project/schema.semver.json' \
```

### Using it in a GitHub Action

```yaml
name: my-project schemas
on:
  pull_request:
    paths:
      - "graphql/my-project/schema.graphql"
      - "graphql/my-project/schema.semver.json"
jobs:
  semver:
    name: Checks version bump
    runs-on: ubuntu-latest
    steps:
      - name: Set up the code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - name: Walk around
        run: |
          git checkout "$GITHUB_BASE_REF"
          git checkout "$GITHUB_HEAD_REF"
      - name: Setup deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: Run the bumper
        run: |
          deno run --allow-run=git \
            'https://raw.githubusercontent.com/PedroHLC/graphql-semver-bump/main/index.ts'  \
            "$GITHUB_BASE_REF" \
            "$GITHUB_HEAD_REF" \
            'graphql/my-project/schema.graphql' \
            'graphql/my-project/schema.semver.json' \
```
