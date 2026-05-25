#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_REPO="${TEMPLATE_REPO:-gileck/app-template-ai}"
PROJECTS_DIR="${PROJECTS_DIR:-$HOME/Projects}"

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

  local clone_url
  clone_url="$(gh repo view "$repo_name" --json sshUrl --jq .sshUrl)"

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

  if [[ ! -d node_modules ]]; then
    log_step "Installing dependencies"
    echo "Running: yarn install"
    yarn install
  else
    log_step "Dependencies already installed"
    echo "Found node_modules, skipping yarn install."
  fi

  log_step "Running project initializer"
  echo "Running: yarn init-project"
  yarn init-project

  log_step "Done"
  echo "Project ready at: $target_dir"
}

main "$@"
