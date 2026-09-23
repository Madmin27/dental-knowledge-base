# apps/review-portal

Academic review and contribution interface.

The invited **private photo pilot** is implemented at `/review/`: Keycloak OIDC
and OTP, scoped accounts, encrypted JPEG/PNG intake, security processing,
independent human privacy decisions and owner erasure. Real intake stays closed
until the owner assigns and verifies the first participants and privacy reviewer.

[Deployment, invitations and recovery](../../docs/PRIVATE-PHOTO-PILOT.md).
The broader delivery contract remains [ADR0007](../../docs/adr/0007-self-hosted-academic-governance.md)
and [ADR0008](../../docs/adr/0008-media-contributions-and-model-candidates.md).
Academic discussions, ballots, appeals, AI reconstruction and publication are
not implemented by this milestone. Privacy clearance is only for the stated
private inspection scope. GitHub holds code, never participant material.
