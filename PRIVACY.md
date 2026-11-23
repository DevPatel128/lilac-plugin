<!-- Privacy note for the Lilac plugin: what is stored, where, and how to delete it. -->
# Privacy

> **Plain-language starting point, not legal advice; have a qualified lawyer review it before relying on it.**

## What this project does not do
- It does not create accounts or ask you to sign in.
- It does not send telemetry: no telemetry.
- It does not run analytics: no analytics.
- It does not send data to the maintainer.
- It does not read your files outside the project you point it at and \`~/.lilac\`.

## Your own sites
Sites you build with Lilac are yours. You decide what they collect and who sees it. You are responsible for their privacy notices and for the laws that apply to them. This file describes facts about the plugin only. It makes no claim that you or this project meet any privacy law.

## What is stored
Lilac keeps these on your machine only, all redacted (secrets and personal data are scrubbed before writing):

- per-agent run records
- lessons
- patterns

Locations:

- `~/.lilac/agents/<name>/learned/` for each agent
- `.lilac/` inside your project

## What is sent
By default nothing is sent anywhere. Telemetry is off. There are no accounts and no sign-in.

Sharing what you learned is opt-in and is a later feature. When it exists it will show you exactly what it sends before anything leaves your machine.

## Delete everything
```
rm -r ~/.lilac
rm -r .lilac
```
Run the second command in each project where you used Lilac.

## The optional learning hook

The plugin includes one `Stop` hook (`hooks/hooks.json`). It does nothing until you run `learn on`. When on, it records only the task text, the outcome, the failed checks and a rework count, redacted, in `~/.lilac/agents/<name>/learned/`. It makes no network calls. Turn it off with `learn off`; delete everything with `rm -r ~/.lilac`. Details: `hooks/README.md`.

## The one tool that uses the network

`scripts/monitor.mjs` checks links, uptime and page performance of a site. It only runs when you pass it a URL, never at install and never from a hook. It contacts only that site (and, for link checks, the links on it), at most one request per second, and sends no data about you or your projects.

