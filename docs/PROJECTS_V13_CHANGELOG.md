# Projects v13 Changelog

## AI input upgrades

- Refined Voice-to-Text in the AI drawer with a clear microphone button and recording pulse state.
- Added image upload for the AI drawer with thumbnail preview before sending.
- AI chat requests now support `image_base64` and `image_mime_type`.

## Gemini Vision receipt reader

- Added a Vision flow for receipt images using `gemini-1.5-flash`.
- Receipt extraction uses JSON mode so Gemini returns machine-readable structured data.
- The frontend renders `create_expense` suggestions as approval cards.
- Expenses created from AI suggestions refresh Dashboard and Finance pages without F5.

## Mini-RAG for class notes

- Added SQLite FTS5 table `workspace_fts` with startup sync and triggers.
- Knowledge retrieval now searches notes with FTS first and falls back to the safe LIKE-based search.
- AI context injects only the top 2 relevant notes instead of sending the whole workspace.

