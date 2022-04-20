#!/usr/bin/env deno

import { printf, sprintf } from "https://deno.land/std@0.135.0/fmt/printf.ts";
import {
  introspectionFromSchema,
  IntrospectionOutputTypeRef,
  IntrospectionType,
} from "https://deno.land/x/graphql_deno@v15.0.0/mod.ts";
import { makeExecutableSchema } from "https://deno.land/x/graphql_tools@0.0.2/mod.ts";

type BumpKind = "MAJOR" | "MINOR" | "PATCH";
type Declaration = { field: string; notation: string; sensible: boolean };
type SemVer = { major: number; minor: number; patch: number };

async function gitGrab(
  decoder: TextDecoder,
  ref: string,
  file: string,
): Promise<string | Error | null> {
  try {
    const path = sprintf("%s:%s", ref, file);
    const process = Deno.run({
      cmd: ["git", "show", path],
      stdout: "piped",
      stderr: "piped",
    });

    const status = await process.status();
    if (status.success) {
      const output = await process.output();
      return decoder.decode(output);
    } else return null;
  } catch (error) {
    return error;
  }
}

async function gitTest(): Promise<
  "NO_GIT" | "NOT_REPO" | "SUCCESS" | Error | null
> {
  try {
    const process = Deno.run({
      cmd: ["git", "status"],
      stdout: "piped",
      stderr: "piped",
    });

    const status = await process.status();
    if (status.success) return "SUCCESS";
    else if (status.code === 128) return "NOT_REPO";
    else if (status.code === 127) return "NO_GIT";
    else return null;
  } catch (error) {
    return error;
  }
}
function guessVersion(previous: SemVer, compare: BumpKind): SemVer {
  const current = previous;
  if (compare === "MAJOR") {
    current.major += 1;
  } else if (compare === "MINOR") {
    current.minor += 1;
  } else {
    current.patch += 1;
  }
  return current;
}

const printSemVer = (v: SemVer) =>
  sprintf("%d.%d.%d\n", v.major, v.minor, v.patch);

const printDeclaration = (d: Declaration) =>
  console.log("  -", d.field, ":", d.notation);

function compareDeclarations(
  before: Declaration[],
  after: Declaration[],
): BumpKind {
  const uniqueLeft = before.filter(compare(after));
  const uniqueRight = after.filter(compare(before));
  if (uniqueLeft.length > 0) {
    console.log(
      "There are removals and/or renames => Major bump found.",
      "\n\nRemovals:",
    );
    uniqueLeft.forEach(printDeclaration);
    if (uniqueRight.length > 0) {
      console.log("Additions:");
      uniqueRight.forEach(printDeclaration);
    }
    return "MAJOR";
  } else if (uniqueRight.length > 0) {
    if (uniqueRight.filter((d) => d.sensible)) {
      console.log(
        "New union-values or enum-values => Major bump found.",
        "\n\nAdditions:",
      );
      uniqueRight.forEach(printDeclaration);
      return "MAJOR";
    } else {
      console.log(
        "New fields/types/queries => Minor bump found.",
        "\n\nAdditions:",
      );
      uniqueRight.forEach(printDeclaration);
      return "MINOR";
    }
  } else {
    return "PATCH";
  }
}

const compare = (
  counterpart: Declaration[],
) => (
  (i: Declaration) => (
    counterpart.findIndex(
      (o: Declaration) => i.field === o.field && i.notation === o.notation,
    ) === -1
  )
);

function typeNotation(type: any): string {
  if (type.kind === "NON_NULL") {
    return typeNotation(type.ofType) + "!";
  } else if (type.kind === "LIST") {
    return "[" + typeNotation(type.ofType) + "]";
  } else if (
    type.kind === "SCALAR" || type.kind === "UNION" || type.kind === "ENUM" ||
    type.kind === "OBJECT" || type.kind === "INPUT_OBJECT"
  ) {
    return type.name;
  } else {
    console.log("Unsupported field type:", type);
    Deno.exit(6);
    return type.type + ":" + type.name;
  }
}

function getTypeDeclaration(
  data: IntrospectionType,
): Declaration[] {
  let items = [];

  if (data.kind === "OBJECT" || data.kind === "INTERFACE") {
    const interfaces = data.interfaces.map((i) => i.name).join(",");

    items.push({
      field: data.name,
      notation: data.kind + ":" + interfaces,
      sensible: false,
    });
  } else {
    items.push({ field: data.name, notation: data.kind, sensible: false });
  }

  if (data.kind === "OBJECT" || data.kind === "INTERFACE") {
    items = items.concat(data.fields.map((e) => ({
      field: data.name + "." + e.name,
      notation: typeNotation(e.type),
      sensible: false,
    })));
  }

  if (data.kind === "INPUT_OBJECT") {
    items = items.concat(data.inputFields.map((e) => ({
      field: data.name + "." + e.name,
      notation: typeNotation(e.type),
      sensible: false,
    })));
  }

  if (data.kind === "ENUM") {
    items = items.concat(data.enumValues.map((e) => ({
      field: data.name + "." + e.name,
      notation: "ENUM_VALUE",
      sensible: true,
    })));
  }

  if (data.kind === "UNION" || data.kind === "INTERFACE") {
    items = items.concat(data.possibleTypes.map((e) => ({
      field: data.name + "." + e.name,
      notation: "POSSIBLE_" + e.kind,
      sensible: true,
    })));
  }

  if (
    ["SCALAR", "OBJECT", "ENUM", "UNION", "INPUT_OBJECT", "INTERFACE"]
      .indexOf(data.kind) === -1
  ) {
    console.log("Unsupported type:", data);
    Deno.exit(5);
  }

  return items;
}

async function gitGrabSemVer(
  decoder: TextDecoder,
  ref: string,
  file: string,
): Promise<SemVer> {
  const raw = await gitGrab(decoder, ref, file);

  if (raw instanceof Error || raw === null) {
    printf(
      'Unable to retrieve "%s:%s" file. Supposing it to be "0.0.0"\n',
      ref,
      file,
    );
    return ({ major: 0, minor: 0, patch: 0 });
  } else {
    return JSON.parse(raw);
  }
}

function declarationsFromSchema(typeDefs: string): Declaration[] {
  const introspectionResult = introspectionFromSchema(
    makeExecutableSchema({ typeDefs }),
  );
  const types = introspectionResult.__schema.types || [];
  return types.map(getTypeDeclaration).flat();
}

function equalSemVer(a: SemVer, b: SemVer): boolean {
  return (a.major === b.major && a.minor === b.minor && a.patch === b.patch);
}

async function main(args: string[]): Promise<number> {
  if (Deno.args.length != 4) {
    console.log(
      "Wrong number of arguments. Usage:\n\tdeno run --allow-run=git graphql-semver-bump.ts [main] [some-branch] [schema.graphql] [schema.ver]",
    );
    return 4;
  }

  const gitAvability = await gitTest();
  if (gitAvability === "NO_GIT") {
    console.log("You need git for this to work.");
    return 5;
  } else if (gitAvability === "NOT_REPO") {
    console.log("You need to be inside a git repository.");
    return 6;
  } else if (gitAvability === null) {
    console.log("Unexpected git error.");
    return 7;
  } else if (gitAvability instanceof Error) {
    console.log(gitAvability);
    return 8;
  }

  const baseRef = Deno.args[0];
  const headRef = Deno.args[1];
  const schemaFile = Deno.args[2];
  const semverFile = Deno.args[3];
  const decoder = new TextDecoder();

  const baseSchema = await gitGrab(decoder, baseRef, schemaFile);
  const headSchema = await gitGrab(decoder, headRef, schemaFile);

  const baseSemVer = await gitGrabSemVer(decoder, baseRef, semverFile);
  const headSemVer = await gitGrabSemVer(decoder, headRef, semverFile);

  if (baseSchema instanceof Error || baseSchema === null) {
    printf('Unable to retrieve "%s:%s" file.', baseRef, schemaFile);
    return 2;
  }

  if (headSchema instanceof Error || headSchema === null) {
    printf('Unable to retrieve "%s:%s" file.', headRef, schemaFile);
    return 3;
  }

  let expectedSemVer = baseSchema !== headSchema
    ? guessVersion(
      baseSemVer,
      compareDeclarations(
        declarationsFromSchema(baseSchema),
        declarationsFromSchema(headSchema),
      ),
    )
    : baseSemVer;

  if (expectedSemVer.major <= 0) {
    expectedSemVer = { major: 1, minor: 0, patch: 0 };
  }

  if (!equalSemVer(headSemVer, expectedSemVer)) {
    printf(
      '\n"%s" version mismatch. Expected: %s\n',
      headRef,
      printSemVer(expectedSemVer),
    );
    return 1;
  } else {
    console.log("\nNothing to do here.");
    return 0;
  }
}

Deno.exit(await main(Deno.args));
