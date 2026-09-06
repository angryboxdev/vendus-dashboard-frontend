export interface PairingCodeProps {
  code: string;
  expiresAt: Date;
  description?: string | null;
}

export class PairingCode {
  readonly code: string;
  readonly expiresAt: Date;
  readonly description: string | null;

  private constructor(props: PairingCodeProps) {
    this.code = props.code;
    this.expiresAt = props.expiresAt;
    this.description = props.description ?? null;
  }

  static create(props: PairingCodeProps): PairingCode {
    return new PairingCode(props);
  }

  remainingSeconds(now: Date = new Date()): number {
    return Math.max(0, Math.floor((this.expiresAt.getTime() - now.getTime()) / 1000));
  }

  isExpired(now: Date = new Date()): boolean {
    return this.remainingSeconds(now) <= 0;
  }
}
