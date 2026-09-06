export interface PairingStatus {
  paired: boolean;
}

/**
 * Async: a local token must be revalidated against the server before a
 * screen renders as paired, so a revoked token doesn't keep passing. See
 * README ADR — supersedes the earlier synchronous/local-only design.
 */
export interface GetPairingStatusPort {
  execute(): Promise<PairingStatus>;
}
