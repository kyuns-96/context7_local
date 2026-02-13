# Release Notes: v1.0.8 - Python Frameworks Expansion (Django & Streamlit)

**Release Date**: February 13, 2026  
**Release Type**: Monolithic Database Update & Technical Capability Expansion  
**Total Libraries**: 210  
**Total Code Snippets**: ~668,386  

## 🎯 Release Highlights

This release marks a significant expansion into the **Python ecosystem**, providing comprehensive documentation for **Django** (covering 4 major versions) and **Streamlit**. We've also implemented a new **reStructuredText (RST) parser**, enabling support for framework documentation that doesn't use Markdown as its primary format.

### Key Achievements

✅ **Massive Django Coverage**: Added 31,554 snippets across 4 versions (6.0, 5.2 LTS, 5.1, 4.2 LTS)  
✅ **Streamlit Support**: Added latest Streamlit v1.54.0 with 1,234 snippets  
✅ **RST Parser Implementation**: New capability to parse `.txt` and `.rst` documentation files  
✅ **1,371x Django Improvement**: Increased Django coverage from 23 snippets to over 31,000  
✅ **Expanded Database**: Monolithic database now totals 5.4 GB with 210 libraries  

---

## 📦 What's New in v1.0.8

### 🆕 Python Framework Documentation

#### Django (Comprehensive Version Coverage)
We have added full documentation for all currently supported and upcoming Django versions. This replaces the previous placeholder coverage with exhaustive API references.
- **Django 6.0**: 8,119 snippets
- **Django 5.2.x LTS**: 8,016 snippets
- **Django 5.1.x**: 7,834 snippets
- **Django 4.2.x LTS**: 7,585 snippets

#### Streamlit v1.54.0
- **1,234 snippets**
- Full coverage of Streamlit's data science and dashboarding components
- Classified under the **Data** domain for split database users

---

## 🛠 Technical Implementation

### reStructuredText (RST) Support
Django and many other Python projects use reStructuredText for their documentation. To support these, we've introduced:
- **`src/scraper/rst.ts`**: A dedicated parser for RST formatting.
- **`src/scraper/github.ts`**: Updated to detect and ingest both `.md` and `.txt` files from repositories.
- **`src/cli/ingest.ts`**: Enhanced routing logic to handle different file extensions based on project structure.

### Domain Classification Updates
- **`scripts/split-database.ts`**: Updated to include Streamlit in the **data.db** domain, ensuring Python data tools are grouped logically.

---

## 📊 Version Coverage

| Library | Versions Available | Latest Added in v1.0.8 |
|---------|-------------------|------------------------|
| **Django** | v4.2 LTS, v5.1, v5.2 LTS, **v6.0** | v6.0 ✨ |
| **Streamlit** | **v1.54.0** | v1.54.0 ✨ |
| **React** | v16.x - v19.2.4 | (v1.0.7) |
| **Node.js** | v18.x - v25.6.1 | (v1.0.7) |

---

## 🚀 Quick Start

### Download Monolithic Database (v1.0.8)

**Note**: Due to GitHub's 2GB file size limit, the database is split into two parts.

```bash
# Download both parts of the v1.0.8 database
curl -L -O https://github.com/kyuns-96/context7_local/releases/download/v1.0.8/docs-v1.0.8.db.tar.gz.partaa
curl -L -O https://github.com/kyuns-96/context7_local/releases/download/v1.0.8/docs-v1.0.8.db.tar.gz.partab

# Combine the parts and extract
cat docs-v1.0.8.db.tar.gz.part* | tar -xz

# Rename and run
mv docs-v1.0.3.db docs.db
bun run src/server/index.ts --transport http --port 3000 --db docs.db
```

### Upgrade Path from v1.0.7

If you are currently using the split databases from v1.0.7, you can continue to use them. However, to get the new Django and Streamlit documentation, you should:

1. Download the new monolithic `docs.db` (v1.0.8).
2. Or, if you prefer split databases, wait for the updated `backend.db` and `data.db` which will be released shortly after this monolithic update.

---

## 📊 Statistics Comparison

| Metric | v1.0.7 | v1.0.8 (Current) |
|--------|---------|-------------------|
| **Database Size (Uncompressed)** | 5.01 GB | 5.4 GB |
| **Total Libraries** | 205 | 210 |
| **Total Code Snippets** | 635,598 | ~668,386 |
| **Python Coverage** | Minimal | **Comprehensive** |
| **RST Support** | ❌ No | ✅ Yes |

---

## 📝 Release Files

| File | Size | Description |
|------|------|-------------|
| `docs-v1.0.8.db.tar.gz.partaa` | 2.0 GB | Database part 1 of 2 |
| `docs-v1.0.8.db.tar.gz.partab` | 247 MB | Database part 2 of 2 |

**Total compressed size**: 2.2 GB (5.4 GB uncompressed)

---

## 🙏 Acknowledgments

Special thanks to:
- The **Django Software Foundation** for their exhaustive documentation.
- The **Streamlit** team for their developer-friendly docs.

---

**Previous Release**: [v1.0.7 - February 2026 Updates](./RELEASE_NOTES_v1.0.7.md)  
**Download**: https://github.com/kyuns-96/context7_local/releases/tag/v1.0.8
