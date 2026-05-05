package main

import (
	"errors"
	"os"
	"os/exec"
	"strings"
)

var errEdgeNotFound = errors.New("msedge.exe not found in standard install locations")

// defaultEdgeCandidates returns the standard Windows install locations for Edge,
// after expanding %PROGRAMFILES%, %PROGRAMFILES(X86)%, %LOCALAPPDATA%.
func defaultEdgeCandidates() []string {
	expand := func(envVar string) string {
		v := os.Getenv(envVar)
		if v == "" {
			return ""
		}
		return v + `\Microsoft\Edge\Application\msedge.exe`
	}
	out := []string{}
	for _, env := range []string{"PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"} {
		if c := expand(env); c != "" {
			out = append(out, c)
		}
	}
	return out
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// discoverEdge returns the first existing path from candidates.
func discoverEdge(candidates []string, exists func(string) bool) (string, error) {
	for _, c := range candidates {
		if exists(c) {
			return c, nil
		}
	}
	return "", errEdgeNotFound
}

// buildEdgeArgs constructs the argv (without the executable itself).
//
// On Azure-AD-joined Windows machines (especially Edge for Business with
// cloud-managed policies like ForceSync=true), Edge integrates with the OS
// Web Account Manager broker and silently signs the user in via their
// Primary Refresh Token — even with a fresh --user-data-dir. That breaks
// tenant isolation: opening a Microsoft URL auto-signs you in as the
// Windows user, regardless of which tenant profile you launched.
//
// We layer multiple disable flags to break the broker integration and the
// Chromium-level browser sign-in feature. On non-managed devices this is
// fully effective. On Edge for Business with mandatory cloud policies,
// browser flags can be overridden by tenant policies; in that case the
// recommended workaround is a separate local Windows user or a different
// browser fork — see docs/SMOKE-TEST.md.
func buildEdgeArgs(userDataDir, url string) []string {
	args := []string{
		"--user-data-dir=" + userDataDir,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-features=" + strings.Join(disabledFeatures, ","),
		"--disable-component-extensions-with-background-pages",
	}
	if url != "" {
		args = append(args, url)
	}
	return args
}

// disabledFeatures is the kitchen-sink list of Chromium/Edge feature flags
// that participate in implicit sign-in. Order doesn't matter; duplicates
// are harmless. Keep this list ordered alphabetically for review sanity.
var disabledFeatures = []string{
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

// launchEdge starts msedge.exe detached and returns immediately.
// Returns nil error when the process was started successfully.
func launchEdge(edgeExe string, args []string) error {
	cmd := exec.Command(edgeExe, args...)
	if err := cmd.Start(); err != nil {
		return err
	}
	// Detach: don't wait for the child.
	go func() { _ = cmd.Wait() }()
	return nil
}
