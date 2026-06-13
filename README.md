# HireMax: Resume Optimization & Processing

A resume analysis and optimization platform with Chrome extension support for real-time resume feedback.

## Overview

- Resume parsing and structured data extraction from PDF/DOCX/TXT
- Chrome extension for in-page resume analysis
- PDF generation and export capabilities
- Integration with Gemini API for content analysis
- Cloudflare Workers for serverless backend functions

## Tech Stack

**Frontend:**
- Vite + React 19
- Framer Motion for animations
- html2canvas, jsPDF for PDF generation
- Supabase for auth and data storage

**Backend:**
- Cloudflare Workers for edge functions
- Supabase (PostgreSQL)
- Mammoth.js for document parsing

**Extensions:**
- Chrome extension with React overlay
- Tailwind CSS + Radix UI components

## Key Features

- Resume file upload and parsing
- PDF viewer with annotation
- Real-time feedback from Gemini API
- Chrome extension overlay for job sites
- Export optimized resumes to PDF
- Data persistence via Supabase

## Getting Started

```bash
npm install
npm run dev
```

For Chrome extension:
```bash
cd apps/extension/chrome-extension/overlay
npm run build
```

Deploy to Cloudflare:
```bash
npm run deploy
```

## Project Structure

```
hiremaxf/
├── apps/web/              # Main Vite React app
├── apps/extension/        # Chrome extension
├── workers/               # Cloudflare Workers
│   ├── intelligence-pipeline/
│   ├── intelligence-distributor/
│   ├── intelligence-content-factory/
│   └── intelligence-admin-api/
└── preflight/             # Validation scripts
```

## Environment Setup

Requires:
- `GEMINI_API_KEY` - Google Gemini API
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- Cloudflare account for Workers deployment
