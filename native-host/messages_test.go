package main

import (
	"encoding/json"
	"testing"
)

func TestParseRequest_Ping(t *testing.T) {
	req, err := parseRequest([]byte(`{"type":"ping"}`))
	if err != nil {
		t.Fatal(err)
	}
	if req.Type != "ping" {
		t.Errorf("Type = %q, want %q", req.Type, "ping")
	}
}

func TestParseRequest_Launch(t *testing.T) {
	body := `{
		"type": "launch",
		"tenantId": "abc",
		"userDataDir": "C:\\tenants\\mueller",
		"storageBasePath": "C:\\tenants",
		"url": "https://portal.azure.com"
	}`
	req, err := parseRequest([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	if req.Type != "launch" || req.UserDataDir != `C:\tenants\mueller` || req.URL == "" {
		t.Errorf("unexpected request: %+v", req)
	}
}

func TestParseRequest_InvalidJSON(t *testing.T) {
	_, err := parseRequest([]byte(`{not-json`))
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestErrorResponse_Marshal(t *testing.T) {
	resp := errorResponse("PATH_NOT_WHITELISTED", "nope")
	bs, err := json.Marshal(resp)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"type":"error","code":"PATH_NOT_WHITELISTED","message":"nope"}`
	if string(bs) != want {
		t.Errorf("got %s, want %s", bs, want)
	}
}

func TestOkResponse_Marshal(t *testing.T) {
	resp := okResponse(map[string]any{"running": true})
	bs, err := json.Marshal(resp)
	if err != nil {
		t.Fatal(err)
	}
	if string(bs) != `{"type":"ok","data":{"running":true}}` {
		t.Errorf("unexpected: %s", bs)
	}
}

func TestOkResponse_NoData(t *testing.T) {
	resp := okResponse(nil)
	bs, _ := json.Marshal(resp)
	if string(bs) != `{"type":"ok"}` {
		t.Errorf("got %s, want %q", bs, `{"type":"ok"}`)
	}
}
