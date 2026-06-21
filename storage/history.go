package storage

import (
	"time"
)

type HistoryEntry struct {
	ID              string `json:"id"`
	RequestID       string `json:"requestId"`
	StatusCode      int    `json:"statusCode"`
	DurationMs      int64  `json:"durationMs"`
	SizeBytes       int64  `json:"sizeBytes"`
	ResponseBody    string `json:"responseBody"`
	ResponseHeaders string `json:"responseHeaders"`
	TestResults     string `json:"testResults"`
	CreatedAt       string `json:"createdAt"`
}

func (db *DB) SaveHistory(entry HistoryEntry) error {
	if entry.ID == "" {
		entry.ID = NewID()
	}
	_, err := db.conn.Exec(`
		INSERT INTO request_history(id, request_id, status_code, duration_ms, size_bytes, response_body, response_headers, test_results)
		VALUES(?,?,?,?,?,?,?,?)`,
		entry.ID, entry.RequestID, entry.StatusCode, entry.DurationMs, entry.SizeBytes,
		entry.ResponseBody, entry.ResponseHeaders, entry.TestResults,
	)
	if err != nil {
		return err
	}
	return db.TrimHistory(entry.RequestID, 20)
}

func (db *DB) TrimHistory(requestID string, keep int) error {
	if keep <= 0 {
		keep = 20
	}
	_, err := db.conn.Exec(`
		DELETE FROM request_history
		WHERE request_id = ? AND id NOT IN (
			SELECT id FROM (
				SELECT id FROM request_history
				WHERE request_id = ?
				ORDER BY created_at DESC
				LIMIT ?
			)
		)`, requestID, requestID, keep)
	return err
}

func (db *DB) UpdateLatestHistoryTests(requestID, testResults string) error {
	_, err := db.conn.Exec(`
		UPDATE request_history SET test_results = ?
		WHERE id = (
			SELECT id FROM request_history
			WHERE request_id = ?
			ORDER BY created_at DESC
			LIMIT 1
		)`, testResults, requestID)
	return err
}

func (db *DB) ListHistory(requestID string, limit int) ([]HistoryEntry, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := db.conn.Query(`
		SELECT id, request_id, status_code, duration_ms, size_bytes, response_body, response_headers, test_results, created_at
		FROM request_history WHERE request_id = ? ORDER BY created_at DESC LIMIT ?`, requestID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []HistoryEntry
	for rows.Next() {
		var h HistoryEntry
		var created time.Time
		if err := rows.Scan(&h.ID, &h.RequestID, &h.StatusCode, &h.DurationMs, &h.SizeBytes, &h.ResponseBody, &h.ResponseHeaders, &h.TestResults, &created); err != nil {
			return nil, err
		}
		h.CreatedAt = created.Format(time.RFC3339)
		list = append(list, h)
	}
	return list, rows.Err()
}
