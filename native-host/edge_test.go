package main

import (
	"errors"
	"strings"
	"testing"
)

func TestBuildEdgeArgs_BasicLaunch(t *testing.T) {
	args := buildEdgeArgs(`C:\tenants\mueller`, `https://portal.azure.com`)
	// Static prefix: user-data-dir, --no-first-run, --no-default-browser-check.
	wantPrefix := []string{
		`--user-data-dir=C:\tenants\mueller`,
		`--no-first-run`,
		`--no-default-browser-check`,
	}
	for i, w := range wantPrefix {
		if args[i] != w {
			t.Errorf("args[%d] = %q, want %q", i, args[i], w)
		}
	}
	// URL is the last argument.
	if args[len(args)-1] != `https://portal.azure.com` {
		t.Errorf("last arg = %q, want URL", args[len(args)-1])
	}
}

func TestBuildEdgeArgs_DisablesAllSSOFeatures(t *testing.T) {
	// Phase 1 smoke test caught Edge for Business cloud policy ForceSync=true
	// silently re-signing the user in via WAM/PRT despite our user-data-dir
	// isolation. We layer multiple feature-disable flags to maximize coverage
	// across Edge versions and Edge for Business policy interactions.
	args := buildEdgeArgs(`C:\tenants\mueller`, ``)

	requiredFeatures := []string{
		"AccountConsistency",
		"AzureADSSOForChromium",
		"BrowserSignin",
		"EdgeAutoSignIn",
		"EdgeImplicitSignin",
		"EnableImplicitSignin",
		"msAccountManager",
		"msSingleSignOn",
		"WebAccountManagerToWindowsCloudAP",
	}
	var disableFlag string
	for _, a := range args {
		if strings.HasPrefix(a, "--disable-features=") {
			disableFlag = a
			break
		}
	}
	if disableFlag == "" {
		t.Fatal("no --disable-features flag in args")
	}
	for _, feat := range requiredFeatures {
		if !strings.Contains(disableFlag, feat) {
			t.Errorf("--disable-features missing %q (got %q)", feat, disableFlag)
		}
	}
	// Also need to disable component extensions (Edge bundles its AAD SSO
	// extension as a built-in component extension, not a regular one).
	foundCompExt := false
	for _, a := range args {
		if a == "--disable-component-extensions-with-background-pages" {
			foundCompExt = true
			break
		}
	}
	if !foundCompExt {
		t.Error("missing --disable-component-extensions-with-background-pages")
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
