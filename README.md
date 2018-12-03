JSON with links.

# Description

This library provides a function for loading JSON documents which contain links to other JSON documents.
When loading JSON from a file, the function will resolve and load any linked documents referenced from within the JSON and return a single object graph.
Nested links (i.e. links within linked documents) will be resolved and loaded.

# Links

Links are described using string values with a `@` prefix, e.g.:

```json
{
    "link": "@data/file.json"
}
```

All links are treated as file paths to a target JSON file.
Link references can be absolute or relative; relative paths are resolved against the path of the containing file.

# Git links

Links can also reference a specific version of a file contained within a git repository history.
This is done by appending `#` to the end of the file path, followed by a git commit-ish (e.g. a branch name or commit hash).
For this to work, the file at the specified path has to be contained within a non-bare git repository (e.g. within a cloned copy of a repo).

Example:

```json
{
    "git": "@data/file.json#live-branch"
}
```

# Required links

Links are optional by default - i.e. if the file referenced by the link isn't found then then `null` is assigned to the property value.
A link can be marked as non-optional by prefixing the path with `!`, e.g.:

```json
{
    "required": "@!data/file.json"
}
```

If a required link references a non-existent file then an exception will be throw when loading the JSON

Note that exceptions will always be thrown for other errors when loading linked JSON (e.g. if the referenced file exists but contains invalid JSON).

# Link variables

Links can contain variable references which will be resolved against a variable context to give the file path to be loaded.
Variable references are composed of a name within the `${...}` variable delimiters, e.g.:

```json
{
    "template": "@lang/${locale}/data.json"
}
```

The process environment is used as the default variable context.

