#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_REPO="${TEMPLATE_REPO:-gileck/app-template-ai}"
PROJECTS_DIR="${PROJECTS_DIR:-$HOME/Projects}"

# Local checkout of the template (this script lives in <template>/scripts/template/).
# Its node_modules is reused to avoid a slow/flaky network install in the child.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_LOCAL_DIR="${TEMPLATE_LOCAL_DIR:-$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)}"

usage() {
  cat <<'EOF'
Create a GitHub repository from the app-template-ai template, clone it into
~/Projects, and run yarn init-project in the cloned project.

Usage:
  create-project [PROJECT_NAME]
  yarn create-project [PROJECT_NAME]
  scripts/template/create-project-from-template.sh [PROJECT_NAME]

Optional environment variables:
  TEMPLATE_REPO=gileck/app-template-ai
  PROJECTS_DIR=~/Projects
  TEMPLATE_LOCAL_DIR=<local template checkout>  # reuse its node_modules
EOF
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

log_step() {
  echo
  echo "==> $1"
}

ensure_gitignore_entry() {
  local entry="$1"
  local gitignore_path=".gitignore"

  if [[ ! -f "$gitignore_path" ]]; then
    printf '%s\n' "$entry" > "$gitignore_path"
    return
  fi

  if ! grep -Fxq "$entry" "$gitignore_path"; then
    printf '\n%s\n' "$entry" >> "$gitignore_path"
  fi
}

prompt_required() {
  local prompt="$1"
  local value=""

  while [[ -z "$value" ]]; do
    read -r -p "$prompt: " value
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
  done

  printf '%s\n' "$value"
}

prompt_visibility() {
  local visibility=""

  while [[ -z "$visibility" ]]; do
    read -r -p "Repository visibility [private/public/internal] (private): " visibility
    visibility="${visibility:-private}"

    case "$visibility" in
      private|public|internal)
        printf '%s\n' "$visibility"
        return
        ;;
      *)
        echo "Please enter private, public, or internal." >&2
        visibility=""
        ;;
    esac
  done
}

wait_for_repo_content() {
  local repo_full="$1"
  local max_attempts=30
  local attempt=1

  # Creating a repo from a template is asynchronous: GitHub returns from
  # `gh repo create` immediately, then copies the template files in the
  # background. The commits endpoint returns 409 ("Git Repository is empty")
  # until generation finishes, then 200. Cloning before that yields an empty
  # repository (no package.json), which breaks `yarn init-project`.
  while (( attempt <= max_attempts )); do
    if gh api "repos/$repo_full/commits?per_page=1" >/dev/null 2>&1; then
      return 0
    fi
    if (( attempt == 1 )); then
      echo "Waiting for GitHub to finish generating the repository from the template..."
    fi
    sleep 2
    (( attempt++ ))
  done

  echo "Timed out waiting for the repository to be generated from the template." >&2
  echo "Check https://github.com/$repo_full and retry once it has content." >&2
  return 1
}

validate_repo_name() {
  local repo_name="$1"

  if [[ "$repo_name" == */* ]]; then
    echo "Use only the repository name. The script creates it in your authenticated GitHub account." >&2
    exit 1
  fi

  if [[ ! "$repo_name" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "Repository names may contain only letters, numbers, dots, underscores, and hyphens." >&2
    exit 1
  fi
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  if [[ $# -gt 1 ]]; then
    echo "Usage: create-project [PROJECT_NAME]" >&2
    exit 1
  fi

  require_command gh
  require_command git
  require_command yarn

  gh auth status >/dev/null

  local repo_name
  repo_name="${1:-}"
  if [[ -z "$repo_name" ]]; then
    repo_name="$(prompt_required "Project/repo name")"
  fi
  validate_repo_name "$repo_name"

  local visibility
  visibility="$(prompt_visibility)"

  mkdir -p "$PROJECTS_DIR"

  local target_dir="$PROJECTS_DIR/$repo_name"
  if [[ -e "$target_dir" ]]; then
    echo "Target directory already exists: $target_dir" >&2
    exit 1
  fi

  log_step "Creating GitHub repo '$repo_name' from template '$TEMPLATE_REPO'"
  echo "Visibility: $visibility"
  echo "This can take a minute while GitHub generates the repository from the template."

  gh repo create "$repo_name" "--$visibility" --template "$TEMPLATE_REPO"

  local repo_full clone_url
  repo_full="$(gh repo view "$repo_name" --json nameWithOwner --jq .nameWithOwner)"
  clone_url="$(gh repo view "$repo_name" --json sshUrl --jq .sshUrl)"

  wait_for_repo_content "$repo_full"

  log_step "Cloning repository"
  echo "Clone URL: $clone_url"
  echo "Target: $target_dir"

  git clone --progress "$clone_url" "$target_dir"

  cd "$target_dir"

  log_step "Untracking yarn.lock"
  echo "Adding yarn.lock to .gitignore and removing it from git tracking for this project."
  ensure_gitignore_entry "yarn.lock"
  git rm --cached --ignore-unmatch --sparse yarn.lock

  if [[ -f yarn.lock ]]; then
    log_step "Removing template yarn.lock"
    echo "Deleting yarn.lock so yarn regenerates it for this machine's registry access."
    rm yarn.lock
  fi

  if [[ ! -d node_modules && -d "$TEMPLATE_LOCAL_DIR/node_modules" && "$TEMPLATE_LOCAL_DIR" != "$target_dir" ]]; then
    log_step "Reusing template node_modules"
    echo "Copying node_modules from $TEMPLATE_LOCAL_DIR to skip a fresh network install."
    # On APFS, -c clones copy-on-write (near-instant, no extra disk). Fall back to
    # a plain recursive copy on filesystems that do not support cloning.
    cp -cR "$TEMPLATE_LOCAL_DIR/node_modules" node_modules 2>/dev/null \
      || cp -R "$TEMPLATE_LOCAL_DIR/node_modules" node_modules
  fi

  if [[ ! -d node_modules ]]; then
    log_step "Installing dependencies"
    echo "Running: yarn install"
    yarn install
  else
    log_step "Reconciling dependencies"
    echo "Running: yarn install --prefer-offline"
    # node_modules is already present (copied from the template or a prior run);
    # this regenerates yarn.lock and patches any drift using the local cache first.
    yarn install --prefer-offline
  fi

  log_step "Running project initializer"
  echo "Running: yarn init-project"
  yarn init-project

  log_step "Done"
  echo "Project ready at: $target_dir"
}

main "$@"
