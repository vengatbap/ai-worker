import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export const dynamic = "force-dynamic"

/**
 * GET /api/workspace/[projectId]/files
 *
 * Returns the file tree for a project's repository.
 * The UI never reads the filesystem directly — all file access goes through this route.
 *
 * Query params:
 *   ?filepath=src/app/page.tsx  — returns the content of a single file
 *   (no filepath)               — returns the full directory tree
 */
export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params
  const { searchParams } = new URL(req.url)
  const filepath = searchParams.get("filepath")

  const repoRoot = path.resolve(process.cwd(), "workspace", projectId, "repository")

  if (!fs.existsSync(repoRoot)) {
    if (filepath) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 })
    }
    return NextResponse.json({ tree: [], repoRoot: null })
  }

  // ── Single file content request ──────────────────────────────────────────
  if (filepath) {
    const safeFilePath = path.join(repoRoot, filepath)

    // Security: prevent path traversal outside the repo
    if (!safeFilePath.startsWith(repoRoot)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 })
    }

    if (!fs.existsSync(safeFilePath) || fs.statSync(safeFilePath).isDirectory()) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    try {
      const content = fs.readFileSync(safeFilePath, "utf-8")
      const ext = path.extname(filepath).slice(1)
      return NextResponse.json({ filepath, content, language: ext })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  // ── Directory tree ───────────────────────────────────────────────────────
  function buildTree(dir: string, relativeTo: string): TreeNode[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const nodes: TreeNode[] = []

    for (const entry of entries) {
      // Skip internal directories
      if (["node_modules", ".git", "snapshots", ".next"].includes(entry.name)) continue

      const fullPath  = path.join(dir, entry.name)
      const entryPath = path.relative(relativeTo, fullPath).replace(/\\/g, "/")

      if (entry.isDirectory()) {
        nodes.push({
          name:     entry.name,
          path:     entryPath,
          type:     "directory",
          children: buildTree(fullPath, relativeTo),
        })
      } else {
        const stat = fs.statSync(fullPath)
        nodes.push({
          name:      entry.name,
          path:      entryPath,
          type:      "file",
          extension: path.extname(entry.name).slice(1),
          sizeBytes: stat.size,
        })
      }
    }

    // Directories first, then files, both alphabetically
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  try {
    const tree = buildTree(repoRoot, repoRoot)
    return NextResponse.json({ tree, projectId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

interface TreeNode {
  name:       string
  path:       string
  type:       "file" | "directory"
  extension?: string
  sizeBytes?: number
  children?:  TreeNode[]
}
