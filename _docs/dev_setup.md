Dev Setup
=========

# ArtCraft 

ArtCraft is a Rust / Tauri app.

To set up the ArtCraft development environment,  install the following:

1. [Install Rust](https://doc.rust-lang.org/cargo/getting-started/installation.html).
2. [Install npm](https://nodejs.org/en/download) or [nvm](https://github.com/nvm-sh/nvm). (Node version `v24.13.0` works at time of writing.) 
3. [Install nx](https://nx.dev/docs/getting-started/installation). (Nx version `v22.4.5` works at time of writing.)
4. [Install Tauri CLI](https://v2.tauri.app/reference/cli/). (Version `tauri-cli 2.10.0` works at time of writing.)

An easy way to get started with running the app in development is to run the two commands (in separate terminals):

**Mac and Linux Development** 

```bash
# Run the frontend dev server
./script/artcraft/unix_frontend_dev.sh

# Run the Tauri Rust application
./script/artcraft/unix_rust_dev.sh
```

**Windows Development**

```powershell
# Run the frontend dev server
.\script\artcraft\windows_frontend_dev.ps1

# Run the Tauri Rust application
.\script\artcraft\windows_rust_dev.ps1
```


# ArtCraft Server

ArtCraft's server is a Rust / Actix app called `storyteller-web`.

You don't need to run this to develop the ArtCraft application, but it can be useful to spin up 
a development instance for adding new server functions or as your own private local copy.

See [dev_setup_server.md](./dev_setup_server.md) for instructions.
