# SaaS Builder AI Company Coding Standards & Guidelines

1. **Architecture Style**: Clean structure, modular, interface-driven. No direct file writes inside agent blocks; all output must go through the Artifact Service.
2. **Double Output Rule**: Every execution MUST produce two parallel outputs:
   - Human-readable markdown files.
   - Machine-readable structured JSON files conforming exactly to target type contracts.
3. **Deterministic Output Structure**: Ensure JSON keys match schemas perfectly. Avoid markdown formatting blocks inside raw JSON responses if JSON is requested directly.
4. **Safety & Policies**: No files can be updated outside the project workspace.
