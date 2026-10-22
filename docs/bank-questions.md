# Bank questions response shape

The v1 contract was validated against the session questions endpoint. The envelope is `{ data, meta }`; each item uses `ref`, 1-based `number`, `subject`, `passage` (object or null; passage HTML is in its `text`/`html` fields), `question: { text, image_url? }`, `options: [{ key, text }]`, and optional `your_choice` and `flagged`. Review responses add `correct_choice` and `is_correct`. PastQ treats the envelope and nested records as passthrough/lenient because the Bank may add fields. Only `https://` image URLs are forwarded.
