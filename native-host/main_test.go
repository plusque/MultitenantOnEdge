package main

import (
	"encoding/json"
	"testing"
)

type launchCall struct {
	exe  string
	args []string
}

func mockSetup() (*launchCall, func(string, []string) error, func(string) bool, []string) {
	call := &launchCall{}
	launch := func(exe string, args []string) error {
		call.exe = exe
		call.args = args
		return nil
	}
	exists := func(p string) bool { return p == `C:\Program Files\Microsoft\Edge\Application\msedge.exe` }
	candidates := []string{`C:\Program Files\Microsoft\Edge\Application\msedge.exe`}
	return call, launch, exists, candidates
}

func TestHandle_Ping(t *testing.T) {
	call, launch, exists, candidates := mockSetup()
	resp := handle([]byte(`{"type":"ping"}`), candidates, exists, launch)
	if resp.Type != "ok" {
		t.Errorf("got type %q", resp.Type)
	}
	if call.exe != "" {
		t.Error("ping should not invoke launch")
	}
}

func TestHandle_Launch_RejectsBadPath(t *testing.T) {
	_, launch, exists, candidates := mockSetup()
	body := `{"type":"launch","userDataDir":"D:\\evil","storageBasePath":"C:\\tenants","url":"https://portal.azure.com"}`
	resp := handle([]byte(body), candidates, exists, launch)
	if resp.Type != "error" || resp.Code != "PATH_NOT_WHITELISTED" {
		bs, _ := json.Marshal(resp)
		t.Errorf("got %s", bs)
	}
}

func TestHandle_Launch_InvalidJSON(t *testing.T) {
	_, launch, exists, candidates := mockSetup()
	resp := handle([]byte(`{not-json`), candidates, exists, launch)
	if resp.Code != "INVALID_REQUEST" {
		t.Errorf("got code %q", resp.Code)
	}
}

func TestHandle_Launch_NoEdge(t *testing.T) {
	_, launch, _, _ := mockSetup()
	exists := func(string) bool { return false }
	body := `{"type":"launch","userDataDir":"C:\\tenants\\m","storageBasePath":"C:\\tenants","url":""}`
	resp := handle([]byte(body), []string{`C:\nope.exe`}, exists, launch)
	if resp.Code != "EDGE_NOT_FOUND" {
		t.Errorf("got code %q (%s)", resp.Code, resp.Message)
	}
}
