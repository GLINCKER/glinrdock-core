---
title: Using Search
section: Using
slug: using/search
tags: search, navigation, command-palette, find
version: v1
audience: user
---

# Using Search

GLINRDOCK's powerful search feature helps you quickly find and navigate to any resource in your system.

## Command Palette

The fastest way to search and navigate is using the Command Palette.

### Opening the Command Palette

- **Keyboard shortcut**: Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
- **Click**: Click the search icon in the top navigation bar
- **Menu**: Use the search option in the main menu

### Using the Command Palette

1. Type your search query
2. Use arrow keys (↑/↓) to navigate results
3. Press `Enter` to go to the selected result
4. Press `Esc` to close the palette

## What You Can Search

### Services

Find your deployed applications:
- Search by service name: `"blog"`
- Filter by status: `"running"` or `"stopped"`
- Find by container: `"nginx"` or `"postgres"`

### Routes

Locate routing configurations:
- Search by domain name: `"example.com"`
- Find by service target: `"api"`
- Search SSL status: `"https"` or `"certificate"`

### Projects

Navigate project organization:
- Find by project name: `"website"` or `"backend"`
- Search by description or tags
- Locate project resources

### Settings and Configuration

Access system settings quickly:
- `"settings"` - Main settings page
- `"users"` - User management
- `"security"` - Security configuration
- `"integrations"` - External service connections

## Search Tips

### Basic Search

- **Simple terms**: Type what you're looking for: `"blog"`, `"api"`, `"database"`
- **Partial matches**: Search works with partial words: `"serv"` finds "services"
- **Case insensitive**: Search works regardless of capitalization

### Advanced Search

- **Multiple words**: Search for phrases: `"blog frontend service"`
- **Search operators**: Use specific filters (see below)
- **Recent searches**: Your recent searches appear when you open the palette

### Search Operators

Use special operators to filter results:

- `type:service` - Only show services
- `type:route` - Only show routes  
- `type:project` - Only show projects
- `type:page` - Only show documentation and settings pages

**Examples**:
- `type:service nginx` - Find nginx services
- `type:route api` - Find routes containing "api"
- `type:project blog` - Find projects with "blog"

## Search Categories

### Filter by Category

Click category tabs in the search palette to filter results:

- **All** - Show everything
- **Services** - Your deployed applications
- **Routes** - Network routing and domains
- **Projects** - Project organization
- **Pages** - Settings and documentation
- **Settings** - Configuration pages

### Smart Suggestions

As you type, GLINRDOCK provides intelligent suggestions:
- **Recent items** - Things you've accessed recently
- **Popular items** - Frequently accessed resources
- **Quick actions** - Common tasks you can perform
- **Related items** - Resources related to your search

## Quick Navigation

### Frequent Destinations

Common searches that work well:
- `"dashboard"` - Return to main dashboard
- `"logs"` - View system logs
- `"metrics"` - System performance data
- `"health"` - System health status
- `"backup"` - Backup and restore options

### Service Management

Quick service actions:
- `"add service"` - Create new service
- `"templates"` - Browse service templates
- `"deployments"` - View deployment history
- `"resources"` - Check resource usage

### System Administration

Administrative functions:
- `"users"` - Manage user accounts
- `"tokens"` - API tokens and authentication
- `"audit"` - View audit logs
- `"system"` - System-wide settings

## Search Results

### Understanding Results

Each search result shows:
- **Title** - Name of the resource
- **Type** - What kind of resource (service, route, etc.)
- **Description** - Brief summary or status
- **Path** - Where it's located in the interface

### Result Actions

- **Click** or **Enter** - Navigate to the resource
- **Right-click** - Show context menu with additional actions
- **Hover** - Preview additional information

## Keyboard Shortcuts

### Navigation

- `↑/↓` - Move between search results
- `Enter` - Open selected result
- `Esc` - Close search palette
- `Tab` - Move between result categories

### Search

- `Cmd+K` / `Ctrl+K` - Open search palette
- `Cmd+Shift+K` / `Ctrl+Shift+K` - Open search in new window
- `Backspace` - Clear search and start over

## Search Performance

### Fast Search

GLINRDOCK search is designed to be fast:
- **Instant results** - Results appear as you type
- **Cached data** - Frequent searches are cached for speed
- **Efficient indexing** - All resources are indexed for quick access

### Offline Search

Search works even when:
- Network connectivity is limited
- Services are temporarily unavailable
- System is under heavy load

## Troubleshooting Search

### Search Not Working

If search isn't responding:
1. Refresh the page in your browser
2. Clear browser cache and cookies
3. Try a different browser or incognito mode
4. Check if GLINRDOCK service is running properly

### No Results Found

If you can't find what you're looking for:
1. Try different search terms or keywords
2. Check spelling and try partial words
3. Use search operators to filter results
4. Browse categories manually if search fails

### Slow Search Results

To improve search performance:
1. Clear browser cache
2. Close unused browser tabs
3. Restart GLINRDOCK if system resources are low
4. Try more specific search terms

## Search Best Practices

### Effective Searching

- **Use specific terms** - "nginx service" instead of just "service"
- **Try multiple approaches** - If one search doesn't work, try different words
- **Use filters** - Category filters and operators help narrow results
- **Leverage recent searches** - Your search history helps with repeated tasks

### Organization Tips

- **Use consistent naming** - Name services and routes consistently
- **Add descriptions** - Detailed descriptions improve searchability
- **Use tags** - Tag resources to improve discoverability
- **Group related items** - Organize resources logically in projects

For more help with navigation and search, see our [getting started guide](../guides/getting-started.md).