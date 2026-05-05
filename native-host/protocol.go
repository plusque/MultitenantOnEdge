package main

import (
	"encoding/binary"
	"fmt"
	"io"
)

// Chromium's native messaging limit is 1 MB per direction. We cap below that
// to leave headroom for unforeseen overhead.
const maxMessageSize = 1024 * 1024

// readMessage reads a single Native Messaging frame from r:
// 4-byte little-endian length prefix followed by that many UTF-8 bytes.
func readMessage(r io.Reader) ([]byte, error) {
	var length uint32
	if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
		return nil, fmt.Errorf("read length prefix: %w", err)
	}
	if length > maxMessageSize {
		return nil, fmt.Errorf("message too large: %d > %d", length, maxMessageSize)
	}
	buf := make([]byte, length)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, fmt.Errorf("read payload: %w", err)
	}
	return buf, nil
}

// writeMessage writes a single Native Messaging frame to w.
func writeMessage(w io.Writer, payload []byte) error {
	if len(payload) > maxMessageSize {
		return fmt.Errorf("payload too large: %d > %d", len(payload), maxMessageSize)
	}
	if err := binary.Write(w, binary.LittleEndian, uint32(len(payload))); err != nil {
		return fmt.Errorf("write length prefix: %w", err)
	}
	if _, err := w.Write(payload); err != nil {
		return fmt.Errorf("write payload: %w", err)
	}
	return nil
}
