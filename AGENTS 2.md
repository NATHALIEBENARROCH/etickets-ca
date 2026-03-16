# Repository Agent Rules

## Critical Safety Rule

- Never edit `.env.local` in this repository unless the user explicitly asks for that exact file change in the current message.
- Require an explicit authorization phrase before editing `.env.local`: `AUTORIZO EDITAR .env.local`.
- If the phrase is not present, refuse to edit `.env.local` and continue with alternatives.
- If a task could involve environment values, read `.env.local` only when needed and do not write changes.
- If uncertain, ask before touching `.env.local`.
