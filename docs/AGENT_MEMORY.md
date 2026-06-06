# Agent Memory

Persistent working notes for agents using this repository.

## WSL command context

Run repository commands inside WSL Ubuntu bash.

Project UNC path:

```text
\\wsl.localhost\Ubuntu\home\fenix\soft-cypher-ventures\social-media-manager\social-media-director
```

WSL path:

```text
/home/fenix/soft-cypher-ventures/social-media-manager/social-media-director
```

Command pattern:

```bash
wsl bash -lc 'cd /home/fenix/soft-cypher-ventures/social-media-manager/social-media-director && <command>'
```

The default Windows sandbox may fail before execution on this WSL path. Use the
approved, scoped `wsl bash` path for project commands.
