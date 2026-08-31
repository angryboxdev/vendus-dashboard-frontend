/**
 * A location (store/restaurant) belonging to the caller's organization.
 * Read-only on the frontend — locations are provisioned on the backend,
 * never created or edited from here.
 */
export interface LocationDTO {
  id: string;
  name: string;
  code: string;
  timezone: string;
  isActive: boolean;
}
