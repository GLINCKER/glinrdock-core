package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/GLINCKER/glinrdock/internal/crypto"
	_ "github.com/mattn/go-sqlite3"
)

// Store wraps database connection and prepared statements
type Store struct {
	db        *sql.DB
	masterKey []byte
	keyMutex  sync.RWMutex
	*EnvironmentStore
	*RegistryStore
}

// Open creates data directory and opens SQLite database
func Open(dataDir string) (*Store, error) {
	// Create data directory if missing
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	dbPath := filepath.Join(dataDir, "glinrdock.db")
	// Add SQLite connection parameters to enable extensions and optimize for search
	dsn := dbPath + "?_foreign_keys=on&_journal_mode=WAL&_synchronous=NORMAL&_cache_size=1000"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}

	// Note: FTS5 table creation is now done after migrations in main.go

	return &Store{
		db:               db,
		EnvironmentStore: NewEnvironmentStore(db),
		RegistryStore:    NewRegistryStore(db),
	}, nil
}

// Close closes the database connection
func (s *Store) Close() error {
	return s.db.Close()
}

// InitializeFTS5 creates FTS5 virtual tables and triggers after migrations complete
func (s *Store) InitializeFTS5() error {
	// Test if FTS5 is available and create virtual table if needed
	var ftsAvailable int
	err := s.db.QueryRow("SELECT sqlite_compileoption_used('ENABLE_FTS5')").Scan(&ftsAvailable)
	if err == nil && ftsAvailable == 1 {
		// Create FTS5 virtual table for search
		if err := createSearchFTSTable(s.db); err != nil {
			// Log error but don't fail - will fall back to basic search
			println("Warning: Failed to create FTS5 virtual table:", err.Error())
			return err
		}
	} else {
		// FTS5 not available, application will fall back to basic search
	}
	return nil
}

// getMasterKey returns the cached master key, loading it from environment if needed
func (s *Store) getMasterKey() ([]byte, error) {
	s.keyMutex.RLock()
	if s.masterKey != nil {
		key := make([]byte, len(s.masterKey))
		copy(key, s.masterKey)
		s.keyMutex.RUnlock()
		return key, nil
	}
	s.keyMutex.RUnlock()

	s.keyMutex.Lock()
	defer s.keyMutex.Unlock()

	// Double-check after acquiring write lock
	if s.masterKey != nil {
		key := make([]byte, len(s.masterKey))
		copy(key, s.masterKey)
		return key, nil
	}

	// Load master key from environment
	key, err := crypto.LoadMasterKeyFromEnv()
	if err != nil {
		return nil, err
	}

	// Cache the key
	s.masterKey = make([]byte, len(key))
	copy(s.masterKey, key)

	// Return a copy
	result := make([]byte, len(key))
	copy(result, key)
	return result, nil
}

// createSearchFTSTable creates the FTS5 virtual table for search
func createSearchFTSTable(db *sql.DB) error {
	// Create FTS5 virtual table that mirrors search_docs structure
	createFTSQuery := `
		CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
			title, 
			subtitle, 
			body, 
			tags,
			content_rowid=id,
			content='search_docs'
		)`

	if _, err := db.Exec(createFTSQuery); err != nil {
		return fmt.Errorf("failed to create search_fts table: %w", err)
	}

	// Create triggers to keep FTS5 in sync with search_docs
	triggers := []string{
		// INSERT trigger
		`CREATE TRIGGER IF NOT EXISTS search_docs_ai AFTER INSERT ON search_docs BEGIN
			INSERT INTO search_fts(rowid, title, subtitle, body, tags) 
			VALUES (new.id, new.title, new.subtitle, new.body, new.tags);
		END`,

		// DELETE trigger
		`CREATE TRIGGER IF NOT EXISTS search_docs_ad AFTER DELETE ON search_docs BEGIN
			INSERT INTO search_fts(search_fts, rowid, title, subtitle, body, tags) 
			VALUES('delete', old.id, old.title, old.subtitle, old.body, old.tags);
		END`,

		// UPDATE trigger
		`CREATE TRIGGER IF NOT EXISTS search_docs_au AFTER UPDATE ON search_docs BEGIN
			INSERT INTO search_fts(search_fts, rowid, title, subtitle, body, tags) 
			VALUES('delete', old.id, old.title, old.subtitle, old.body, old.tags);
			INSERT INTO search_fts(rowid, title, subtitle, body, tags) 
			VALUES (new.id, new.title, new.subtitle, new.body, new.tags);
		END`,
	}

	for _, trigger := range triggers {
		if _, err := db.Exec(trigger); err != nil {
			return fmt.Errorf("failed to create FTS5 trigger: %w", err)
		}
	}

	return nil
}
