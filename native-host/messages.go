package main

import (
	"encoding/json"
	"fmt"
)

type request struct {
	Type            string `json:"type"`
	TenantID        string `json:"tenantId,omitempty"`
	UserDataDir     string `json:"userDataDir,omitempty"`
	StorageBasePath string `json:"storageBasePath,omitempty"`
	URL             string `json:"url,omitempty"`
}

type response struct {
	Type    string `json:"type"`
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
}

func parseRequest(payload []byte) (*request, error) {
	var r request
	if err := json.Unmarshal(payload, &r); err != nil {
		return nil, fmt.Errorf("parse request: %w", err)
	}
	if r.Type == "" {
		return nil, fmt.Errorf("missing type field")
	}
	return &r, nil
}

func okResponse(data any) response {
	return response{Type: "ok", Data: data}
}

func errorResponse(code, message string) response {
	return response{Type: "error", Code: code, Message: message}
}
