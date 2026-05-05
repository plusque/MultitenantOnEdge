package main

import (
	"errors"
	"testing"
)

func TestBuildEdgeArgs_BasicLaunch(t *testing.T) {
	args := buildEdgeArgs(`C:\tenants\mueller`, `https://portal.azure.com`)
	want := []string{
		`--user-data-dir=C:\tenants\mueller`,
		`--no-first-run`,
		`--no-default-browser-check`,
		`--disable-features=msSingleSignOn,msAccountManager,AzureADSSOForChromium`,
		`https://portal.azure.com`,
	}
	if len(args) != len(want) {
		t.Fatalf("len got %d, want %d (%v)", len(args), len(want), args)
	}
	for i := range args {
		if args[i] != want[i] {
			t.Errorf("args[%d] = %q, want %q", i, args[i], want[i])
		}
	}
}

func TestBuildEdgeArgs_DisablesWindowsBrokerSSO(t *testing.T) {
	// Regression: Phase 1 smoke test caught Edge silently using the Windows
	// user's PRT via WAM on AAD-joined devices, breaking tenant isolation.
	args := buildEdgeArgs(`C:\tenants\mueller`, ``)
	found := false
	for _, a := range args {
		if a == `--disable-features=msSingleSignOn,msAccountManager,AzureADSSOForChromium` {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected SSO-disable flag in args, got %v", args)
	}
}

func TestBuildEdgeArgs_OmitsURLWhenEmpty(t *testing.T) {
	args := buildEdgeArgs(`C:\tenants\mueller`, ``)
	for _, a := range args {
		if a == `` {
			t.Error("found empty argument")
		}
	}
	if args[len(args)-1] == `https://portal.azure.com` {
		t.Error("should not have URL when empty was passed")
	}
}

func TestDiscoverEdge_PicksFirstExistingPath(t *testing.T) {
	exists := func(p string) bool {
		return p == `C:\Program Files\Microsoft\Edge\Application\msedge.exe`
	}
	candidates := []string{
		`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
		`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
	}
	got, err := discoverEdge(candidates, exists)
	if err != nil {
		t.Fatal(err)
	}
	if got != `C:\Program Files\Microsoft\Edge\Application\msedge.exe` {
		t.Errorf("got %q", got)
	}
}

func TestDiscoverEdge_ErrorWhenNoneExist(t *testing.T) {
	_, err := discoverEdge([]string{`X:\nope.exe`}, func(string) bool { return false })
	if !errors.Is(err, errEdgeNotFound) {
		t.Errorf("got error %v, want errEdgeNotFound", err)
	}
}
