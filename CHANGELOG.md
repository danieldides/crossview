# Changelog

# v3.8.0 (April 2026)

## Features & Enhancements

- **Handle missing Kubernetes API resources gracefully**  
  - Add `IsMissingKubernetesResourceError` helper to classify missing-resource cases, including the “the server could not find the requested resource” message.
  - Use that helper in Kubernetes resource listing so unsupported APIs return an empty result instead of bubbling up as an error.
  - Update the Kubernetes controller to treat those missing-resource errors as `200 OK` with empty `items`, avoiding the 500 path.
  - Add tests for the new helper and for the controller behavior when `Function` APIs are unavailable.

- **Add support for Managed Resource Definitions (MRD) and Managed Resource Activation Policies (MRAP)**  
  - Introduce dedicated pages for MRDs and MRAPs following the existing XRDs pattern.
  - MRDs page includes columns for NAME, STATE, ESTABLISHED, AGE with multi-filter support and status badges.
  - MRAPs page provides a clean view with NAME and AGE.
  - Both pages include ResourceDetails slideout and improved error handling with messaging for Crossplane 2.0 upgrades.

- **PostgreSQL SSL/TLS connection support**  
  - Add configurable SSL/TLS options for PostgreSQL connections via new environment variables: `DB_SSL_MODE`, `DB_SSL_ROOT_CERT`, `DB_SSL_CERT`, and `DB_SSL_KEY`.
  - Dynamically build the DSN with `sslmode`, `sslrootcert`, `sslcert`, and `sslkey` parameters (supports `disable`, `require`, `verify-ca`, `verify-full`, etc.).
  - Update configuration (`config.yaml`, `loader.js`), Helm chart values, ConfigMap, and deployment templates to support a nested `ssl` object.
  - Default to `sslmode=disable` for backward compatibility.
  - Remove password from connection failure logs for improved security.

- **Automate changelog, release notes, and PR title linting**  
  - Introduce automation using Conventional Commits and `changelog-cli` to generate `CHANGELOG.md` and `RELEASE_NOTES.md` during releases.
  - Add GitHub release integration (attach release notes and use them as description).
  - Enforce consistent PR titles via `lint-pr-title.yml` workflow.
  - Update `docs/CONTRIBUTING.md` with guidelines for PR titles, commits, and release notes.
  - Add local development support (scripts and `changelog-cli` dependency).

## Bug Fixes & Improvements

- **Fix server-side table search to filter full dataset**  
  - Apply search filtering to the complete dataset before pagination (instead of only the current page) in server-side mode.
  - Ensure search terms and searchable fields are properly passed to fetch callbacks.
  - Update filtering logic for Managed Resources, Claims, Composite Resources, Compositions, MRDs, and MRAPs.
  - Use continue tokens for Composite resource retrieval to support full-dataset filtering.
  - Total count now reflects the size of the filtered dataset.

- **Add SSL properties to Helm values schema**  
  - Fix missing SSL configuration properties in the Helm values JSON schema (follow-up to PostgreSQL SSL support).

- **Validate Helm release version against existing GitHub releases**  
  - Add version validation job in the Helm release workflow to prevent publishing arbitrary or mismatched versions.
  - Make test and release jobs dependent on successful validation.
  - Improve error messaging to show already-released versions when validation fails.

- **Updated readme**  
  - Fix `Helm Repository` address in the README (was pointing to the old organization).

- **Provided default values for admin username and password in `helm/crossview/values.yaml`**  
```yaml
secrets:
  adminUsername: "admin"
  adminPassword: "password"
```

- **Improve documentation for production SSO deployments**  
  - Document `server.cors.origin` (`CORS_ORIGIN`) as a required field for any non-local deployment using SSO. When unset, the post-login redirect goes to `http://localhost:5173` instead of the actual host.
  - Add a dedicated "Required: Set `server.cors.origin` for Production" section to `docs/SSO_SETUP.md` with config file, env var, and Helm examples.
  - Update `callbackURL` examples throughout `docs/SSO_SETUP.md` to use a real host (`https://crossview.example.com/api/auth/oidc/callback`) instead of localhost.
  - Add `CORS_ORIGIN` to `docs/CONFIGURATION.md` server settings and SSO troubleshooting section.
  - Add inline warning comment on `config.server.cors.origin` in `helm/crossview/values.yaml`.

- **Document default admin credentials for session auth mode**  
  - Add a "Default Admin Credentials" subsection to `docs/CONFIGURATION.md` noting that the default username/password is `admin`/`password` and documenting how to override them via Helm values or environment variables.
  - Add default credentials as the top item in the Security Best Practices section.

## Contributors

A big thank you to all the contributors who helped make this release possible!

- **conclusionlogic** – for gracefully handling missing Kubernetes API resources
- **ravibagri5** – for adding support for Managed Resource Definitions (MRD) and Managed Resource Activation Policies (MRAP)
- **MoeidHeidari** – for PostgreSQL SSL/TLS connection support and Helm schema fixes
- **Berk-Unsal** – for fixing server-side table search to work on the full dataset
- **erfanmo** – for automating changelog generation, release notes, PR title linting, and Helm version validation

Thank you for your valuable contributions! 🙏