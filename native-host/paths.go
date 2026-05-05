package main

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

// envVarPattern matches Windows-style %ENV_VAR% references.
var envVarPattern = regexp.MustCompile(`%([A-Za-z_][A-Za-z0-9_]*)%`)

// expandEnvVars replaces %VAR% references with their values from the
// process environment. Unknown vars are left as-is so validation surfaces
// them rather than silently producing a relative path.
func expandEnvVars(p string) string {
	return envVarPattern.ReplaceAllStringFunc(p, func(match string) string {
		name := match[1 : len(match)-1]
		if val := os.Getenv(name); val != "" {
			return val
		}
		return match
	})
}

// normalizePath canonicalizes a path: forward-slashes → backslashes on Windows-style paths,
// resolves "." and ".." components, returns absolute lexical form.
func normalizePath(p string) string {
	p = strings.ReplaceAll(p, "/", `\`)

	// filepath.Clean() behaves differently on Linux vs Windows for backslash paths.
	// We manually resolve . and .. to ensure consistent behavior across platforms.
	parts := strings.Split(p, `\`)
	var resolved []string

	for _, part := range parts {
		if part == "" || part == "." {
			continue
		} else if part == ".." {
			if len(resolved) > 0 {
				resolved = resolved[:len(resolved)-1]
			}
		} else {
			resolved = append(resolved, part)
		}
	}

	return strings.Join(resolved, `\`)
}

// isAbsoluteWindows returns true if p looks like an absolute Windows path
// (drive letter or UNC). filepath.IsAbs on non-Windows builds doesn't recognize
// "C:\..." so we check explicitly to keep behavior consistent in tests on Linux.
func isAbsoluteWindows(p string) bool {
	if len(p) >= 3 && p[1] == ':' && (p[2] == '\\' || p[2] == '/') {
		return true
	}
	if strings.HasPrefix(p, `\\`) || strings.HasPrefix(p, `//`) {
		return true
	}
	return false
}

func validateUserDataDir(userDataDir, storageBasePath string) error {
	if storageBasePath == "" {
		return fmt.Errorf("storageBasePath is empty")
	}
	if !isAbsoluteWindows(userDataDir) {
		return fmt.Errorf("userDataDir must be absolute: %q", userDataDir)
	}
	if !isAbsoluteWindows(storageBasePath) {
		return fmt.Errorf("storageBasePath must be absolute: %q", storageBasePath)
	}
	udd := normalizePath(userDataDir)
	base := normalizePath(storageBasePath)

	uddLower := strings.ToLower(udd)
	baseLower := strings.ToLower(base)
	prefix := baseLower + `\`

	if uddLower == baseLower {
		return fmt.Errorf("userDataDir must be a child of storageBasePath, not the base itself")
	}
	if !strings.HasPrefix(uddLower, prefix) {
		return fmt.Errorf("userDataDir %q is not under storageBasePath %q", udd, base)
	}
	return nil
}
