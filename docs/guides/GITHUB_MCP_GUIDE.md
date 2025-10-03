# GitHub MCP Tools Guide for Claude Code

## Overview
This guide explains how to use the GitHub Model Context Protocol (MCP) tools that are available in Claude Desktop. These are the same tools I (Claude in the browser) use.

## Available GitHub MCP Functions

### 1. Repository Management

#### Create a New Repository
```javascript
// Function: github:create_repository
{
  "name": "my-new-repo",           // Required: Repository name
  "description": "My awesome project", // Optional
  "private": false,                 // Optional: Default is public
  "autoInit": true                  // Optional: Initialize with README
}
```

#### Fork a Repository
```javascript
// Function: github:fork_repository
{
  "owner": "original-owner",       // Required: Original repo owner
  "repo": "original-repo",         // Required: Original repo name
  "organization": "my-org"         // Optional: Fork to org instead of personal
}
```

#### Search Repositories
```javascript
// Function: github:search_repositories
{
  "query": "language:python stars:>100", // Required: GitHub search syntax
  "page": 1,                             // Optional: Pagination
  "perPage": 30                          // Optional: Results per page (max 100)
}
```

### 2. File Operations

#### Get File Contents
```javascript
// Function: github:get_file_contents
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required  
  "path": "src/main.py",           // Required: File or directory path
  "branch": "main"                  // Optional: Default branch if not specified
}
```

#### Create or Update Single File
```javascript
// Function: github:create_or_update_file
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "path": "README.md",              // Required
  "content": "# My Project",        // Required: File content
  "message": "Update README",       // Required: Commit message
  "branch": "main",                 // Required
  "sha": "abc123..."               // Required when updating existing file
}
```

#### Push Multiple Files (Recommended for multiple files)
```javascript
// Function: github:push_files
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "branch": "main",                 // Required
  "message": "Add multiple files",  // Required: Commit message
  "files": [                        // Required: Array of files
    {
      "path": "src/app.py",
      "content": "print('Hello')"
    },
    {
      "path": "src/config.json",
      "content": "{\"debug\": true}"
    }
  ]
}
```

### 3. Issues Management

#### Create Issue
```javascript
// Function: github:create_issue
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "title": "Bug: Application crashes", // Required
  "body": "Detailed description",   // Optional
  "labels": ["bug", "high-priority"], // Optional
  "assignees": ["username1"]        // Optional
}
```

#### List Issues
```javascript
// Function: github:list_issues
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "state": "open",                  // Optional: open, closed, all
  "labels": ["bug"],                // Optional: Filter by labels
  "sort": "created",                // Optional: created, updated, comments
  "direction": "desc"               // Optional: asc, desc
}
```

#### Update Issue
```javascript
// Function: github:update_issue
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "issue_number": 42,               // Required
  "title": "Updated title",         // Optional
  "body": "Updated description",    // Optional
  "state": "closed",                // Optional: open or closed
  "labels": ["resolved"]            // Optional
}
```

### 4. Pull Requests

#### Create Pull Request
```javascript
// Function: github:create_pull_request
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "title": "Add new feature",       // Required
  "head": "feature-branch",         // Required: Source branch
  "base": "main",                   // Required: Target branch
  "body": "This PR adds...",        // Optional: Description
  "draft": false                    // Optional: Create as draft
}
```

#### List Pull Requests
```javascript
// Function: github:list_pull_requests
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "state": "open",                  // Optional: open, closed, all
  "sort": "created",                // Optional
  "direction": "desc"               // Optional
}
```

#### Review Pull Request
```javascript
// Function: github:create_pull_request_review
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "pull_number": 123,               // Required
  "body": "Looks good!",            // Required: Review comment
  "event": "APPROVE",               // Required: APPROVE, REQUEST_CHANGES, COMMENT
  "comments": [                     // Optional: Inline comments
    {
      "path": "src/main.py",
      "line": 10,
      "body": "Consider using const here"
    }
  ]
}
```

#### Merge Pull Request
```javascript
// Function: github:merge_pull_request
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "pull_number": 123,               // Required
  "merge_method": "squash",         // Optional: merge, squash, rebase
  "commit_title": "Merged PR #123"  // Optional
}
```

### 5. Branch Operations

#### Create Branch
```javascript
// Function: github:create_branch
{
  "owner": "username",              // Required
  "repo": "repository-name",        // Required
  "branch": "feature-xyz",          // Required: New branch name
  "from_branch": "main"             // Optional: Source branch (defaults to default branch)
}
```

### 6. Search Operations

#### Search Code
```javascript
// Function: github:search_code
{
  "q": "extension:py repo:username/repo TODO", // Required: Search query
  "per_page": 30,                              // Optional
  "page": 1                                    // Optional
}
```

#### Search Issues/PRs
```javascript
// Function: github:search_issues
{
  "q": "is:issue is:open author:username",     // Required: Search query
  "sort": "created",                           // Optional
  "order": "desc"                              // Optional
}
```

## Common Workflows

### 1. Create a New Project and Push Code
```javascript
// Step 1: Create repository
github:create_repository({
  "name": "my-project",
  "description": "A new project",
  "autoInit": true
})

// Step 2: Push multiple files
github:push_files({
  "owner": "gudrodur",
  "repo": "my-project",
  "branch": "main",
  "message": "Initial commit",
  "files": [
    {"path": "src/main.py", "content": "..."},
    {"path": "README.md", "content": "..."},
    {"path": ".gitignore", "content": "..."}
  ]
})
```

### 2. Fork and Contribute
```javascript
// Step 1: Fork the repository
github:fork_repository({
  "owner": "original-owner",
  "repo": "cool-project"
})

// Step 2: Create a feature branch
github:create_branch({
  "owner": "gudrodur",
  "repo": "cool-project",
  "branch": "my-feature"
})

// Step 3: Make changes
github:push_files({
  "owner": "gudrodur",
  "repo": "cool-project",
  "branch": "my-feature",
  "message": "Add new feature",
  "files": [...]
})

// Step 4: Create pull request
github:create_pull_request({
  "owner": "original-owner",
  "repo": "cool-project",
  "title": "Add awesome feature",
  "head": "gudrodur:my-feature",
  "base": "main",
  "body": "This PR adds..."
})
```

### 3. Manage Issues
```javascript
// Create an issue
github:create_issue({
  "owner": "gudrodur",
  "repo": "my-project",
  "title": "Add documentation",
  "body": "We need to add API documentation",
  "labels": ["documentation", "help-wanted"]
})

// Later, close the issue
github:update_issue({
  "owner": "gudrodur",
  "repo": "my-project",
  "issue_number": 1,
  "state": "closed"
})
```

## Important Notes

1. **Authentication**: The GitHub MCP server uses your Claude Desktop GitHub authentication. Make sure you're logged in.

2. **Rate Limits**: GitHub API has rate limits. The MCP server handles this, but be aware of potential delays.

3. **Permissions**: You can only modify repositories you have access to.

4. **File Size**: Large files should be handled carefully. Consider using multiple smaller commits.

5. **Binary Files**: Text content is expected for file operations. Binary files need base64 encoding.

## Error Handling

Common errors and solutions:

- **404 Not Found**: Check owner/repo names and your access permissions
- **422 Validation Failed**: Usually means a required field is missing or invalid
- **401 Unauthorized**: GitHub authentication issue - may need to re-authenticate
- **403 Forbidden**: You don't have permission for this operation

## Tips for Claude Code

1. **Use push_files for multiple files**: It's more efficient than multiple create_or_update_file calls
2. **Always specify branch**: Don't assume default branch names
3. **Check file existence first**: Use get_file_contents before updating
4. **Use descriptive commit messages**: Help track changes
5. **Test with public repos first**: Easier to debug permissions

## Example: Complete Project Setup

```javascript
// 1. Create a new repository
await github:create_repository({
  "name": "claude-desktop-fixes",
  "description": "Fixes for Claude Desktop on Fedora",
  "autoInit": true
})

// 2. Push our fix documentation
await github:push_files({
  "owner": "gudrodur",
  "repo": "claude-desktop-fixes",
  "branch": "main",
  "message": "Add Claude Desktop GPU fix documentation",
  "files": [
    {
      "path": "README.md",
      "content": "# Claude Desktop Fixes\n\n## GPU Fix\n..."
    },
    {
      "path": "scripts/claude-desktop-fixed.sh",
      "content": "#!/bin/bash\n# Fixed launcher script\n..."
    },
    {
      "path": "docs/TROUBLESHOOTING.md",
      "content": "# Troubleshooting Guide\n..."
    }
  ]
})

// 3. Create an issue to track remaining work
await github:create_issue({
  "owner": "gudrodur",
  "repo": "claude-desktop-fixes",
  "title": "Document white bar issue workaround",
  "body": "Need to add documentation for the Wayland white bar issue",
  "labels": ["documentation", "enhancement"]
})
```

---

*Note: These are the same GitHub MCP tools available in Claude (browser). The function names and parameters are identical.*
