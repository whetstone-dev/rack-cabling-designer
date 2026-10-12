# Security

Report vulnerabilities privately through GitHub Security Advisories on this repository.

## Design measures

- **Supply chain.** No dependencies, no build step, no install scripts, nothing downloaded at install or run time. `MANIFEST.json` pins SHA-256 hashes of every installed file. Before installing, the installer refuses a payload that differs from its manifest.
- **Writes are bounded:**
  - The installer writes only to the selected skills folders and to its state folder (`~/.rack-cabling-designer/`).
  - Manifest paths cannot escape the skill folder, and the payload may not contain links.
  - Generated outputs refuse to leave the chosen folder or to write through symbolic links.
- **No silent overwrites:**
  - Existing copies the installer did not make (manual copies, `npx skills`, links) are blocked unless you pass `--force`. Copies with local changes or a newer version are blocked the same way.
  - Replaced copies are backed up outside every skills root, so assistants never discover backups as duplicate skills.
- **Uninstall:** it deletes only the files listed in the install receipt and never follows links. Files you added are kept, and so are the skills folder and your project.
- **No execution of unverified code:**
  - The only process the installer starts is the installed toolkit's self-test, run with the current Node binary and no shell.
  - It runs only for copies whose files match this installer's receipt, or for a link to this checkout. Foreign or modified copies are never executed.
- **No network:** there is no network code in the installer, and a test enforces this.
- **No elevation:** destinations stay inside the home or project folder, and custom folders elsewhere are refused. Running as root triggers a warning.
- **Audit trail:** every real run is logged as JSON lines in `~/.rack-cabling-designer/logs/`.
- **Untrusted model content:**
  - HTML output escapes every value and ships a restrictive Content-Security-Policy with no scripts.
  - Markdown output escapes HTML and table syntax.
  - CSV output neutralizes spreadsheet formulas (`= + - @`).
- **Data sensitivity:** generated documents can reveal site layout, hostnames and circuit references. Review them before sharing outside your organization.

## Known limits

- `policy.labelPattern` is a regular expression taken from the model. A pathological pattern can be slow, so only validate models you trust.
- The installer verifies integrity against the manifest shipped in the same checkout. It does not verify a signature of the checkout itself, so obtain releases from the official repository.
