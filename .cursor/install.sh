#!/usr/bin/env bash
set -euo pipefail

# Cloud Agent install for monaco-unocss.
#
# Node toolchain:
#   The base image pins Node 22 at /exec-daemon/node and prepends /exec-daemon
#   to PATH after shell startup, so it wins over nvm's default. This repo's
#   build uses tsdown's native TypeScript config loader, which needs
#   Node >= 24.11 (matching CI's `node-version: lts/*`, i.e. Node 24 "Krypton").
#   Install Node 24 with nvm and publish shims into /usr/local/cargo/bin -- the
#   only writable PATH entry ahead of /exec-daemon -- so `node`, `pnpm`, and
#   friends resolve to Node 24 in every shell (install, terminals, and the
#   interactive agent shell).

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"

nvm install 24 >/dev/null
node24_bin="$(dirname "$(nvm which 24)")"

shim_dir="/usr/local/cargo/bin"
for bin in node npm npx corepack; do
  ln -sf "$node24_bin/$bin" "$shim_dir/$bin"
done

# Corepack provides the pnpm version pinned by package.json's packageManager.
corepack enable --install-directory "$shim_dir"

export PATH="$shim_dir:$PATH"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

corepack install
pnpm install --frozen-lockfile
pnpm build
