package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"os"
)

func main() {
	if err := run(os.Stdin, os.Stdout, defaultEdgeCandidates(), fileExists, launchEdge); err != nil {
		log.Fatalf("tenant-helper: %v", err)
	}
}

func run(
	in io.Reader,
	out io.Writer,
	edgeCandidates []string,
	exists func(string) bool,
	launch func(string, []string) error,
) error {
	for {
		raw, err := readMessage(in)
		if err != nil {
			// Clean shutdown when the extension closes the port (Edge unloads
			// the host on extension reload, browser quit, or computer sleep).
			if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
				return nil
			}
			return err
		}
		resp := handle(raw, edgeCandidates, exists, launch)
		bs, _ := json.Marshal(resp)
		if err := writeMessage(out, bs); err != nil {
			return err
		}
	}
}

func handle(
	raw []byte,
	edgeCandidates []string,
	exists func(string) bool,
	launch func(string, []string) error,
) response {
	req, err := parseRequest(raw)
	if err != nil {
		return errorResponse("INVALID_REQUEST", err.Error())
	}
	switch req.Type {
	case "ping":
		return okResponse(map[string]any{"pong": true, "version": "0.1.0"})

	case "launch":
		if err := validateUserDataDir(req.UserDataDir, req.StorageBasePath); err != nil {
			return errorResponse("PATH_NOT_WHITELISTED", err.Error())
		}
		edgeExe, err := discoverEdge(edgeCandidates, exists)
		if err != nil {
			return errorResponse("EDGE_NOT_FOUND", err.Error())
		}
		if err := os.MkdirAll(normalizePath(req.UserDataDir), 0o755); err != nil {
			return errorResponse("LAUNCH_FAILED", "create user-data-dir: "+err.Error())
		}
		args := buildEdgeArgs(req.UserDataDir, req.URL)
		if err := launch(edgeExe, args); err != nil {
			return errorResponse("LAUNCH_FAILED", err.Error())
		}
		return okResponse(map[string]any{"launched": true, "edge": edgeExe})

	case "isRunning":
		// Phase 1: simple stub — assume false. We can refine in Phase 2 by
		// checking for the presence of the lockfile inside userDataDir.
		return okResponse(map[string]any{"running": false})

	default:
		return errorResponse("INVALID_REQUEST", "unknown type: "+req.Type)
	}
}
