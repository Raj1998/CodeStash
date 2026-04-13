# Split the Bill

A mobile-first Next.js app for splitting a restaurant bill at the table.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Receipt Upload Setup

The receipt image upload feature uses the Google Gemini vision API.

1. Copy the example env file values into your local env setup.
2. Set your Gemini API key and model:

```bash
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key-here
NEXT_PUBLIC_GEMINI_MODEL=gemini-3-flash-preview
```

`gemini-3-flash-preview` is the current default because older `gemini-1.5-flash` model names are no longer available on the Gemini Developer API.

Because this app currently calls Gemini directly from the browser, the key is exposed to the client. Treat this as a prototype/stretch-goal setup and use an appropriately restricted key.

## Features

- Add people with color-coded avatars
- Add, edit, and delete bill items
- Assign shared items across multiple people
- Quick Split mode for equal bill splitting
- Tax and tip handling in dollars or percentage
- Per-person summary with copy-to-clipboard support
- Receipt image upload to auto-import item lines

## Notes

Receipt upload sends the selected image to Gemini and expects a JSON array of items back. Imported items are added to the normal editable item list, so you can review and correct them before finalizing the split.
