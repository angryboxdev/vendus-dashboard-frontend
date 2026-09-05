export interface PairingStatus {
  paired: boolean;
}

/**
 * Synchronous by design (unlike every other port here): it only reads
 * localStorage, no I/O latency involved. Wrapping it in a Promise would add
 * a needless loading flash before an already-paired screen renders.
 */
export interface GetPairingStatusPort {
  execute(): PairingStatus;
}
