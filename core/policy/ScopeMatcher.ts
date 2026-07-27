import path from "path"
import { ExecutionPackageV2 } from "../interfaces/types"

export class ScopeMatcher {
  /**
   * Normalizes and resolves a target filepath relative to the project workspace repository.
   * If the path attempts traversal outside the repository, it throws a traversals block error.
   */
  public static canonicalize(projectId: string, filepath: string): string {
    // Normalize slashes to forward slashes for cross-platform consistency
    let cleanPath = filepath.replace(/\\/g, "/")

    // Check absolute path escape attempts
    if (path.isAbsolute(cleanPath) || cleanPath.startsWith("/")) {
      throw new Error(`TRAVERSAL_BLOCKED: Absolute path access is denied: ${filepath}`)
    }

    // Resolve relative path segments
    const repositoryRoot = path.resolve(process.cwd(), "workspace", projectId, "repository").replace(/\\/g, "/")
    const resolvedPath = path.resolve(repositoryRoot, cleanPath).replace(/\\/g, "/")

    // Enforce that the resolved path is strictly inside repositoryRoot
    if (!resolvedPath.startsWith(repositoryRoot)) {
      throw new Error(`TRAVERSAL_BLOCKED: Attempted traversal outside repository root: ${filepath}`)
    }

    // Return the path relative to the repository root for scope matching
    let relativePath = path.relative(repositoryRoot, resolvedPath).replace(/\\/g, "/")
    if (relativePath === "" || relativePath === ".") {
      relativePath = ""
    }
    return relativePath
  }

  /**
   * Translates simple glob wildcards (* and **) to strict Regular Expressions.
   */
  private static globToRegex(glob: string): RegExp {
    // Escape standard regex characters except *
    let escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    // Convert double wildcard ** to match anything including subfolders
    escaped = escaped.replace(/\*\*/g, ".*")
    // Convert single wildcard * to match single folder path depth
    escaped = escaped.replace(/(?<!\.)\*/g, "[^/]*")
    return new RegExp(`^${escaped}$`)
  }

  /**
   * Check if a filepath matches a list of glob patterns.
   */
  private static pathMatchesAny(relativePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      const normalizedPattern = pattern.replace(/\\/g, "/")
      const regex = this.globToRegex(normalizedPattern)
      if (regex.test(relativePath)) {
        return true
      }
    }
    return false
  }

  /**
   * Verify if a filepath lies within any protected scopes (Deny always takes precedence over Allow).
   */
  private static isProtected(relativePath: string, pkg: ExecutionPackageV2): boolean {
    // Default protected paths (e.g. metadata files or sandbox configurations)
    const defaultProtected = [".ai/**", "ProjectManifest.json", ".env*"]
    const allProtected = [...defaultProtected, ...(pkg.workspace.protectedScopes || [])]
    return this.pathMatchesAny(relativePath, allProtected)
  }

  public static isReadAllowed(projectId: string, filepath: string, pkg: ExecutionPackageV2): boolean {
    try {
      const relPath = this.canonicalize(projectId, filepath)
      if (this.isProtected(relPath, pkg)) return false
      return this.pathMatchesAny(relPath, pkg.workspace.readScopes)
    } catch {
      return false
    }
  }

  public static isWriteAllowed(projectId: string, filepath: string, pkg: ExecutionPackageV2): boolean {
    try {
      const relPath = this.canonicalize(projectId, filepath)
      if (this.isProtected(relPath, pkg)) return false
      return this.pathMatchesAny(relPath, pkg.workspace.writeScopes)
    } catch {
      return false
    }
  }

  public static isCreateAllowed(projectId: string, filepath: string, pkg: ExecutionPackageV2): boolean {
    try {
      const relPath = this.canonicalize(projectId, filepath)
      if (this.isProtected(relPath, pkg)) return false
      return this.pathMatchesAny(relPath, pkg.workspace.createScopes)
    } catch {
      return false
    }
  }

  public static isDeleteAllowed(projectId: string, filepath: string, pkg: ExecutionPackageV2): boolean {
    try {
      const relPath = this.canonicalize(projectId, filepath)
      if (this.isProtected(relPath, pkg)) return false
      return this.pathMatchesAny(relPath, pkg.workspace.deleteScopes)
    } catch {
      return false
    }
  }

  public static isCommandAllowed(cmd: string, pkg: ExecutionPackageV2): boolean {
    const cleanCmd = cmd.trim()
    const allowed = pkg.permissions.allowedCommands || []
    return allowed.includes(cleanCmd)
  }

  public static isDependencyAllowed(pkg: ExecutionPackageV2): boolean {
    return !!pkg.permissions.allowDependencyInstall
  }

  public static isNetworkAllowed(pkg: ExecutionPackageV2): boolean {
    return !!pkg.permissions.allowNetworkAccess
  }
}
