# Projects v12.1 Changelog

## AI stability and safety polish

- Added Gemini JSON-mode support through `response_mime_type="application/json"` for structured-output calls.
- Kept normal AI chat in Markdown/text mode so advisor responses still render naturally.
- Hardened frontend JSON parsing for AI action data and streaming SSE payloads.
- Limited task context to unfinished tasks due in the next 7 days.
- Kept finance context scoped to the current month only.
- Invalidated task/dashboard/student-hub cache after AI-created tasks.
- Added a cross-page `personal-life:tasks-changed` event so Dashboard and Tasks refresh without requiring F5.

