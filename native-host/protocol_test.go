package main

import (
	"bytes"
	"encoding/binary"
	"strings"
	"testing"
)

func TestReadMessage_RoundTrip(t *testing.T) {
	payload := []byte(`{"type":"ping"}`)
	var buf bytes.Buffer
	if err := binary.Write(&buf, binary.LittleEndian, uint32(len(payload))); err != nil {
		t.Fatal(err)
	}
	buf.Write(payload)

	got, err := readMessage(&buf)
	if err != nil {
		t.Fatalf("readMessage error: %v", err)
	}
	if string(got) != string(payload) {
		t.Errorf("got %q, want %q", got, payload)
	}
}

func TestReadMessage_RejectsOversizedMessage(t *testing.T) {
	var buf bytes.Buffer
	binary.Write(&buf, binary.LittleEndian, uint32(maxMessageSize+1))
	_, err := readMessage(&buf)
	if err == nil {
		t.Fatal("expected error for oversized message, got nil")
	}
}

func TestReadMessage_ReturnsErrOnEOF(t *testing.T) {
	_, err := readMessage(bytes.NewReader(nil))
	if err == nil {
		t.Fatal("expected error on EOF, got nil")
	}
}

func TestWriteMessage_PrefixesLength(t *testing.T) {
	var buf bytes.Buffer
	payload := []byte(`{"type":"ok"}`)
	if err := writeMessage(&buf, payload); err != nil {
		t.Fatal(err)
	}
	wantPrefix := []byte{byte(len(payload)), 0, 0, 0}
	if !bytes.Equal(buf.Bytes()[:4], wantPrefix) {
		t.Errorf("prefix = %v, want %v", buf.Bytes()[:4], wantPrefix)
	}
	if !bytes.Equal(buf.Bytes()[4:], payload) {
		t.Errorf("payload mismatch")
	}
}

func TestWriteMessage_RejectsOversized(t *testing.T) {
	var buf bytes.Buffer
	huge := []byte(strings.Repeat("x", maxMessageSize+1))
	if err := writeMessage(&buf, huge); err == nil {
		t.Fatal("expected error for oversized payload")
	}
}
