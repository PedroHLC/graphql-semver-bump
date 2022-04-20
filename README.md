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
