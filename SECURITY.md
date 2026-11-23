# Security policy

This integration holds the credentials of an Abode account and can disarm a
security system: please report any weakness privately.

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove emails, passwords, tokens, cookies and
  addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## How the integration handles secrets

- The Abode password is a `secret` field of the Gladys configuration; it is
  only sent to `https://my.goabode.com`, over HTTPS.
- Passwords, API keys, OAuth tokens and session cookies are never logged.
- Only a random client identifier is written to disk (`/data/abode.json`).
- Disarming from a dashboard widget is off by default, and every alarm button
  of a widget asks for a confirmation.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
the Abode cloud, apps and devices (report those to Abode Systems).
