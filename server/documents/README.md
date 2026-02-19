# Documents Folder

Place your PDF documents here for ingestion into the RAG system.

## Usage

1. Add PDF files to this folder
2. Run `pnpm run ingest` from the server directory
3. The documents will be processed and stored in Chroma vector database

## Supported Formats

- PDF files (.pdf)

## Example

```bash
# Add your PDFs
cp /path/to/your/document.pdf ./documents/

# Run ingestion
pnpm run ingest
```

## Notes

- PDF files in this directory are ignored by git (see .gitignore)
- Each ingestion will process all PDFs in this folder
- Documents are split into chunks of ~1000 characters with 200 character overlap
