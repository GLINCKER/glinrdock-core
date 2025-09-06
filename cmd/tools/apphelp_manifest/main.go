package main

import (
	"bufio"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type FrontMatter struct {
	Title    string   `json:"title"`
	Section  string   `json:"section"`
	Slug     string   `json:"slug"`
	Tags     []string `json:"tags"`
	Version  string   `json:"version"`
	Audience string   `json:"audience"`
}

type AppHelpFile struct {
	Slug      string    `json:"slug"`
	Title     string    `json:"title"`
	Section   string    `json:"section"`
	RelPath   string    `json:"rel_path"`
	Tags      []string  `json:"tags"`
	Version   string    `json:"version"`
	UpdatedAt time.Time `json:"updated_at"`
	WordCount int       `json:"word_count"`
	ETag      string    `json:"etag"`
}

type AppHelpManifest struct {
	Generated   time.Time     `json:"generated"`
	Version     string        `json:"version"`
	Description string        `json:"description"`
	Files       []AppHelpFile `json:"files"`
	Stats       struct {
		TotalFiles    int            `json:"total_files"`
		TotalWords    int            `json:"total_words"`
		SectionCount  map[string]int `json:"section_count"`
		AudienceCount map[string]int `json:"audience_count"`
		VersionCount  map[string]int `json:"version_count"`
	} `json:"stats"`
}

func main() {
	appdocsDir := "appdocs"
	outputFile := filepath.Join(appdocsDir, "_manifest.json")

	manifest := AppHelpManifest{
		Generated:   time.Now().UTC(),
		Version:     "1.0.0",
		Description: "GLINRDOCK App Help Documentation Manifest",
		Files:       []AppHelpFile{},
	}
	manifest.Stats.SectionCount = make(map[string]int)
	manifest.Stats.AudienceCount = make(map[string]int)
	manifest.Stats.VersionCount = make(map[string]int)

	err := filepath.Walk(appdocsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Skip non-markdown files
		if !strings.HasSuffix(path, ".md") {
			return nil
		}

		// Skip files starting with underscore
		filename := filepath.Base(path)
		if strings.HasPrefix(filename, "_") {
			return nil
		}

		// Parse relative path
		relPath, err := filepath.Rel(appdocsDir, path)
		if err != nil {
			return err
		}

		// Parse front matter and content
		frontMatter, title, wordCount, etag, err := parseMarkdownFile(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: Error parsing %s: %v\n", path, err)
			return nil // Continue processing other files
		}

		// Apply fallbacks
		finalTitle := frontMatter.Title
		if finalTitle == "" {
			finalTitle = title
		}
		if finalTitle == "" {
			finalTitle = strings.TrimSuffix(filepath.Base(path), ".md")
		}

		finalSlug := frontMatter.Slug
		if finalSlug == "" {
			finalSlug = createSlugFromPath(relPath)
		}

		finalSection := frontMatter.Section
		if finalSection == "" {
			finalSection = extractSectionFromPath(relPath)
		}

		// Parse tags from comma-separated string
		tags := parseTags(frontMatter.Tags)

		appFile := AppHelpFile{
			Slug:      finalSlug,
			Title:     finalTitle,
			Section:   finalSection,
			RelPath:   relPath,
			Tags:      tags,
			Version:   frontMatter.Version,
			UpdatedAt: info.ModTime(),
			WordCount: wordCount,
			ETag:      etag,
		}

		manifest.Files = append(manifest.Files, appFile)
		manifest.Stats.SectionCount[finalSection]++
		manifest.Stats.AudienceCount[frontMatter.Audience]++
		manifest.Stats.VersionCount[frontMatter.Version]++

		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error walking appdocs directory: %v\n", err)
		os.Exit(1)
	}

	// Sort files by slug for deterministic output
	sort.Slice(manifest.Files, func(i, j int) bool {
		return manifest.Files[i].Slug < manifest.Files[j].Slug
	})

	// Calculate total stats
	manifest.Stats.TotalFiles = len(manifest.Files)
	totalWords := 0
	for _, file := range manifest.Files {
		totalWords += file.WordCount
	}
	manifest.Stats.TotalWords = totalWords

	// Write pretty JSON
	jsonData, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling JSON: %v\n", err)
		os.Exit(1)
	}

	err = os.WriteFile(outputFile, jsonData, 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error writing manifest file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Generated app help manifest with %d files (%d words total)\n", manifest.Stats.TotalFiles, manifest.Stats.TotalWords)
	fmt.Printf("Sections: ")
	for section, count := range manifest.Stats.SectionCount {
		fmt.Printf("%s:%d ", section, count)
	}
	fmt.Println()
}

func parseMarkdownFile(filePath string) (FrontMatter, string, int, string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return FrontMatter{}, "", 0, "", err
	}
	defer file.Close()

	// Read entire file for ETag calculation
	content, err := io.ReadAll(file)
	if err != nil {
		return FrontMatter{}, "", 0, "", err
	}

	// Calculate ETag (MD5 hash)
	hash := md5.Sum(content)
	etag := fmt.Sprintf("%x", hash)

	// Reset file pointer for line-by-line parsing
	file.Seek(0, 0)
	scanner := bufio.NewScanner(file)

	var frontMatter FrontMatter
	var firstH1 string
	wordCount := 0
	inFrontMatter := false
	frontMatterLines := 0

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Check for front matter start
		if line == "---" && frontMatterLines == 0 {
			inFrontMatter = true
			frontMatterLines++
			continue
		}

		// Check for front matter end
		if line == "---" && inFrontMatter && frontMatterLines > 1 {
			inFrontMatter = false
			continue
		}

		// Parse front matter
		if inFrontMatter {
			frontMatterLines++
			if strings.Contains(line, ":") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					key := strings.TrimSpace(parts[0])
					value := strings.TrimSpace(parts[1])

					switch key {
					case "title":
						frontMatter.Title = value
					case "section":
						frontMatter.Section = value
					case "slug":
						frontMatter.Slug = value
					case "tags":
						frontMatter.Tags = parseTagsFromString(value)
					case "version":
						frontMatter.Version = value
					case "audience":
						frontMatter.Audience = value
					}
				}
			}
			continue
		}

		// Look for first H1 if not in front matter
		if firstH1 == "" && strings.HasPrefix(line, "# ") {
			firstH1 = strings.TrimPrefix(line, "# ")
			firstH1 = strings.TrimSpace(firstH1)
		}

		// Count words in non-empty lines
		if line != "" {
			words := strings.Fields(line)
			wordCount += len(words)
		}
	}

	if err := scanner.Err(); err != nil {
		return FrontMatter{}, "", 0, "", err
	}

	return frontMatter, firstH1, wordCount, etag, nil
}

func parseTagsFromString(tagString string) []string {
	if tagString == "" {
		return []string{}
	}

	// Split by comma and clean up each tag
	rawTags := strings.Split(tagString, ",")
	tags := make([]string, 0, len(rawTags))

	for _, tag := range rawTags {
		tag = strings.TrimSpace(tag)
		if tag != "" {
			tags = append(tags, tag)
		}
	}

	return tags
}

func parseTags(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}

	// If tags is a single element that contains commas, split it
	if len(tags) == 1 && strings.Contains(tags[0], ",") {
		return parseTagsFromString(tags[0])
	}

	// Clean up existing tags
	cleanTags := make([]string, 0, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag != "" {
			cleanTags = append(cleanTags, tag)
		}
	}

	return cleanTags
}

func createSlugFromPath(relPath string) string {
	// Convert to lowercase and replace separators
	slug := strings.ToLower(relPath)
	// Remove .md extension
	slug = strings.TrimSuffix(slug, ".md")
	// Replace path separators with forward slashes (normalize)
	slug = strings.ReplaceAll(slug, "\\", "/")
	return slug
}

func extractSectionFromPath(relPath string) string {
	// Get the first directory component, or "root" if in root
	parts := strings.Split(filepath.ToSlash(relPath), "/")
	if len(parts) > 1 {
		return strings.Title(parts[0]) // Capitalize first letter
	}
	return "Home"
}
