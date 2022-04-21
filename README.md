# graphql-semver-bump

### What?

Deno script that diff two git-references of a GraphQL-schema-file and suggests bumps to a JSON-stored [semver](https://semver.org).

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


## When does it requires a bump?

- **MAJOR**: Bumps when there were removals, renames, when you added arguments to queries/mutations that didn't have any, added **new** non-null fields input, added **new** values to unions, or added **new** values to enums.

- **MINOR**: Bumps when new fields, types, queries, or mutations are added.

- **PATCH**: Bumps when you change deprecation flags or add new comments.

## What does it produces?

You will see something like this in the stdout:

> New fields/types/queries => Minor bump found.
> 
> Additions:
>   - Query.someQuery : SomeResult!
> 
> "this-branch" version mismatch. Expected 3.2.1

The process will exit with success (exit code 0) when the version in the file is the one expected.
